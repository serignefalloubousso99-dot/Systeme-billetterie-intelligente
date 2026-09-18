/**
 * Tests d'API — Confirmation de compte par lien
 *
 * Fonctionnalité : à l'activation, l'utilisateur reçoit un lien valable 48 h
 * lui permettant de choisir lui-même son mot de passe.
 *
 * Ce mécanisme vient EN PLUS du mot de passe temporaire de 8 caractères exigé
 * par le cahier des charges : les tests vérifient que les deux voies restent
 * ouvertes et qu'aucune ne casse l'autre.
 *
 * Distinction importante : 404 signale un lien inconnu, 410 un lien périmé.
 * Le frontend s'appuie dessus pour proposer d'en redemander un.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import { connectTestDb, disconnectTestDb, clearTestDb, creerUtilisateur, creerAdminEtToken } from '../helpers.js';

// Les champs du jeton sont `select: false` : il faut les demander.
const avecJeton = (id) =>
  User.findById(id).select('+confirmationToken +confirmationTokenExpire');

describe('API — Confirmation de compte', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  describe('Génération à l’activation', () => {
    test('crée un jeton valable 48 heures', async () => {
      const user = await creerUtilisateur({ status: 'Bloqué' });

      await request(app)
        .patch(`/api/admin/users/${user.id}/status`)
        .set('Authorization', header)
        .send({ status: 'Actif' })
        .expect(200);

      const active = await avecJeton(user.id);
      assert.ok(active.confirmationToken, 'un jeton doit être généré');
      assert.equal(active.confirmationToken.length, 64, '32 octets en hexadécimal');

      const heures = (active.confirmationTokenExpire - Date.now()) / 3600000;
      assert.ok(heures > 47 && heures <= 48, `expiration attendue à 48 h, obtenue ${heures.toFixed(1)} h`);
    });

    test('génère un jeton différent pour chaque compte', async () => {
      const a = await creerUtilisateur({ status: 'Bloqué' });
      const b = await creerUtilisateur({ status: 'Bloqué' });

      await request(app).patch(`/api/admin/users/${a.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      await request(app).patch(`/api/admin/users/${b.id}/status`).set('Authorization', header).send({ status: 'Actif' });

      const jetonA = (await avecJeton(a.id)).confirmationToken;
      const jetonB = (await avecJeton(b.id)).confirmationToken;
      assert.notEqual(jetonA, jetonB);
    });

    test('n’expose jamais le jeton dans les réponses de l’API', async () => {
      // Il ne doit circuler que par e-mail, vers son destinataire.
      const user = await creerUtilisateur({ status: 'Bloqué' });
      const res = await request(app)
        .patch(`/api/admin/users/${user.id}/status`)
        .set('Authorization', header)
        .send({ status: 'Actif' })
        .expect(200);

      assert.equal(JSON.stringify(res.body).includes('confirmationToken'), false);
    });
  });

  describe('Vérification du lien', () => {
    test('confirme la validité et masque l’adresse', async () => {
      const user = await creerUtilisateur({ status: 'Bloqué', email: 'destinataire@test.com' });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      const { confirmationToken } = await avecJeton(user.id);

      const res = await request(app).get(`/api/auth/confirmation/${confirmationToken}`).expect(200);

      assert.equal(res.body.valide, true);
      assert.match(res.body.email, /^d\*+@test\.com$/, 'l’adresse doit être masquée');
      assert.ok(res.body.expireLe);
    });

    test('distingue un lien inconnu d’un lien périmé', async () => {
      await request(app).get('/api/auth/confirmation/jetoninexistant').expect(404);

      const user = await creerUtilisateur({ status: 'Bloqué' });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      const compte = await avecJeton(user.id);

      // On force l'expiration dans le passé.
      compte.confirmationTokenExpire = new Date(Date.now() - 1000);
      await compte.save();

      const res = await request(app).get(`/api/auth/confirmation/${compte.confirmationToken}`).expect(410);
      assert.match(res.body.message, /expir/i);
    });
  });

  describe('Définition du mot de passe', () => {
    const activerEtRecupererJeton = async (header, surcharges = {}) => {
      const user = await creerUtilisateur({ status: 'Bloqué', ...surcharges });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      return { user, jeton: (await avecJeton(user.id)).confirmationToken };
    };

    test('permet de choisir son mot de passe et de se connecter', async () => {
      const { user, jeton } = await activerEtRecupererJeton(header, { email: 'client@test.com' });

      await request(app)
        .post(`/api/auth/confirmation/${jeton}`)
        .send({ motDePasse: 'MonMotDePasse1' })
        .expect(200);

      const connexion = await request(app)
        .post('/api/auth/login')
        .send({ email: 'client@test.com', password: 'MonMotDePasse1' })
        .expect(200);
      assert.ok(connexion.body.token);

      // Le mot de passe étant choisi par l'utilisateur, plus rien à lui imposer.
      assert.equal((await User.findById(user.id)).mustChangePassword, false);
    });

    test('consomme le lien : il ne sert qu’une fois', async () => {
      const { jeton } = await activerEtRecupererJeton(header);

      await request(app).post(`/api/auth/confirmation/${jeton}`).send({ motDePasse: 'MotDePasse123' }).expect(200);
      await request(app).post(`/api/auth/confirmation/${jeton}`).send({ motDePasse: 'AutreMotDePasse1' }).expect(404);
    });

    test('refuse un mot de passe trop court', async () => {
      const { jeton } = await activerEtRecupererJeton(header);
      const res = await request(app).post(`/api/auth/confirmation/${jeton}`).send({ motDePasse: 'court' }).expect(400);
      assert.match(res.body.message, /8 caractères/i);
    });

    test('refuse un lien inconnu ou périmé', async () => {
      await request(app).post('/api/auth/confirmation/inexistant').send({ motDePasse: 'MotDePasse123' }).expect(404);

      const { user, jeton } = await activerEtRecupererJeton(header);
      const compte = await avecJeton(user.id);
      compte.confirmationTokenExpire = new Date(Date.now() - 1000);
      await compte.save();

      await request(app).post(`/api/auth/confirmation/${jeton}`).send({ motDePasse: 'MotDePasse123' }).expect(410);
    });
  });

  describe('Renvoi du lien par l’administrateur', () => {
    test('régénère un lien et invalide le précédent', async () => {
      const user = await creerUtilisateur({ status: 'Bloqué' });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      const ancien = (await avecJeton(user.id)).confirmationToken;

      const res = await request(app)
        .post(`/api/admin/users/${user.id}/confirmation/renvoyer`)
        .set('Authorization', header)
        .expect(200);
      assert.ok(res.body.expireLe);

      const nouveau = (await avecJeton(user.id)).confirmationToken;
      assert.notEqual(nouveau, ancien);

      // Un seul lien vivant à la fois : l'ancien ne doit plus rien ouvrir.
      await request(app).get(`/api/auth/confirmation/${ancien}`).expect(404);
      await request(app).get(`/api/auth/confirmation/${nouveau}`).expect(200);
    });

    test('refuse pour un compte qui n’attend aucune confirmation', async () => {
      const user = await creerUtilisateur({ status: 'Actif', mustChangePassword: false });
      const res = await request(app)
        .post(`/api/admin/users/${user.id}/confirmation/renvoyer`)
        .set('Authorization', header)
        .expect(409);
      assert.match(res.body.message, /n'attend pas/i);
    });

    test('renvoie 404 pour un compte inexistant', async () => {
      await request(app)
        .post('/api/admin/users/64b5f0000000000000000000/confirmation/renvoyer')
        .set('Authorization', header)
        .expect(404);
    });

    test('reste réservé aux administrateurs', async () => {
      const user = await creerUtilisateur({ status: 'Bloqué' });
      await request(app).post(`/api/admin/users/${user.id}/confirmation/renvoyer`).expect(401);
    });
  });

  describe('Neutralisation du lien', () => {
    test('un changement de mot de passe classique tue le lien de confirmation', async () => {
      // Faille corrigée : le lien restait valide 48 h après que l'utilisateur
      // avait choisi son mot de passe par la voie classique. Quiconque avait
      // accès à l'e-mail d'activation pouvait alors reprendre le compte.
      const user = await creerUtilisateur({ status: 'Bloqué', email: 'proprietaire@test.com' });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });
      const lien = (await avecJeton(user.id)).confirmationToken;

      // L'utilisateur se connecte avec un mot de passe connu du test
      // (le temporaire réel n'est pas récupérable, il part par e-mail).
      const compte = await avecJeton(user.id);
      compte.password = 'MotDePasseTemp1';
      await compte.save();
      const connexion = await request(app)
        .post('/api/auth/login')
        .send({ email: 'proprietaire@test.com', password: 'MotDePasseTemp1' })
        .expect(200);

      // Changement par la voie classique
      await request(app)
        .put('/api/users/profile/password')
        .set('Authorization', `Bearer ${connexion.body.token}`)
        .send({ oldPassword: 'MotDePasseTemp1', newPassword: 'SonVraiMotDePasse1' })
        .expect(200);

      // Le lien d'activation ne doit plus rien ouvrir
      await request(app).get(`/api/auth/confirmation/${lien}`).expect(404);
      await request(app)
        .post(`/api/auth/confirmation/${lien}`)
        .send({ motDePasse: 'MotDePasseAttaquant1' })
        .expect(404);

      // Et le mot de passe choisi reste le bon
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'proprietaire@test.com', password: 'SonVraiMotDePasse1' })
        .expect(200);
    });
  });

  describe('Coexistence avec le mot de passe temporaire', () => {
    test('le mot de passe temporaire reste utilisable tant que le lien n’a pas servi', async () => {
      // Le cahier des charges impose ce mécanisme : il ne doit pas être
      // remplacé par le lien, seulement complété.
      const user = await creerUtilisateur({ status: 'Bloqué' });
      await request(app).patch(`/api/admin/users/${user.id}/status`).set('Authorization', header).send({ status: 'Actif' });

      const active = await User.findById(user.id);
      assert.equal(active.status, 'Actif');
      assert.equal(active.mustChangePassword, true, 'le changement reste imposé tant que le lien n’est pas utilisé');
      assert.ok(active.password.startsWith('$2'), 'le mot de passe temporaire est bien haché');
    });
  });
});
