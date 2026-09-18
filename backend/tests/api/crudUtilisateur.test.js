/**
 * Tests d'API — CRUD utilisateur : lecture unitaire et modification
 *
 * Cas couverts    : A35 à A45 (tableau de synthèse du livrable)
 * Fonctionnalités : F11 — Modification d'un compte, changement de rôle inclus
 *                   F2 — Contrôle d'accès administrateur
 *
 * Le changement de rôle est la partie sensible : accorder « Administrateur »
 * à tort donnerait des privilèges indus sur l'ensemble des comptes. On vérifie
 * donc qu'il fonctionne, mais aussi qu'un rôle hors énumération est rejeté
 * avec un code 400 — et non une erreur serveur (régression §5.3 du livrable).
 *
 * Deux garde-fous sont également couverts : l'e-mail (clé unique d'identification)
 * et le statut ne sont PAS modifiables par cette route. Le statut relève des
 * routes d'activation, qui régénèrent le mot de passe et notifient l'utilisateur.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import {
  connectTestDb,
  disconnectTestDb,
  clearTestDb,
  creerUtilisateur,
  creerAdminEtToken,
} from '../helpers.js';

describe('API — CRUD utilisateur (lecture unitaire et modification)', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  describe('Lecture unitaire', () => {
    test('GET /api/admin/users/:id — renvoie la fiche du compte', async () => {
      const user = await creerUtilisateur({ email: 'fiche@test.com', role: 'Agent' });

      const res = await request(app)
        .get(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .expect(200);

      assert.equal(res.body.user.email, 'fiche@test.com');
      assert.equal(res.body.user.role, 'Agent');
      assert.equal(res.body.user.password, undefined, 'le mot de passe ne doit jamais transiter');
    });

    test('GET /api/admin/users/:id — 404 si le compte n\'existe pas', async () => {
      await request(app)
        .get('/api/admin/users/64b5f0000000000000000000')
        .set('Authorization', header)
        .expect(404);
    });

    test('GET /api/admin/users/:id — exige une authentification', async () => {
      const user = await creerUtilisateur();
      await request(app).get(`/api/admin/users/${user.id}`).expect(401);
    });
  });

  describe('Modification', () => {
    test('PUT /api/admin/users/:id — met à jour les coordonnées', async () => {
      const user = await creerUtilisateur({ nom: 'Ancien', prenom: 'Nom', telephone: '+221770000001' });

      const res = await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ nom: 'Nouveau', prenom: 'Prenom', telephone: '+221779999999' })
        .expect(200);

      assert.equal(res.body.user.nom, 'Nouveau');
      assert.equal(res.body.user.prenom, 'Prenom');
      assert.equal(res.body.user.telephone, '+221779999999');

      const rafraichi = await User.findById(user.id);
      assert.equal(rafraichi.nom, 'Nouveau');
    });

    test('PUT /api/admin/users/:id — change le rôle d\'un utilisateur', async () => {
      // L'administrateur doit pouvoir promouvoir ou rétrograder un compte.
      const user = await creerUtilisateur({ role: 'Client' });

      const res = await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ role: 'Agent' })
        .expect(200);

      assert.equal(res.body.user.role, 'Agent');
      assert.equal((await User.findById(user.id)).role, 'Agent');
    });

    test('PUT /api/admin/users/:id — refuse un rôle hors énumération', async () => {
      const user = await creerUtilisateur({ role: 'Client' });

      // Une saisie invalide relève de la requête, pas d'une panne serveur.
      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ role: 'Superviseur' })
        .expect(400);

      assert.equal((await User.findById(user.id)).role, 'Client', 'le rôle ne doit pas changer');
    });

    test('PUT /api/admin/users/:id — ne modifie que les champs transmis', async () => {
      const user = await creerUtilisateur({ nom: 'Diop', prenom: 'Awa', role: 'Agent' });

      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ nom: 'Fall' })
        .expect(200);

      const rafraichi = await User.findById(user.id);
      assert.equal(rafraichi.nom, 'Fall');
      assert.equal(rafraichi.prenom, 'Awa', 'le prénom doit rester inchangé');
      assert.equal(rafraichi.role, 'Agent', 'le rôle doit rester inchangé');
    });

    test('PUT /api/admin/users/:id — permet de corriger l\'email, sous réserve d\'unicité', async () => {
      const user = await creerUtilisateur({ email: 'original@test.com' });
      const autre = await creerUtilisateur({ email: 'dejapris@test.com' });

      // Format invalide -> 400
      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ email: 'pas-un-email' })
        .expect(400);

      // Email déjà utilisé par un autre compte -> 409
      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ email: autre.email })
        .expect(409);

      // Correction valide -> acceptée et normalisée en minuscules
      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ email: 'CORRIGE@Test.com', nom: 'Test' })
        .expect(200);

      assert.equal((await User.findById(user.id)).email, 'corrige@test.com');
    });

    test('PUT /api/admin/users/:id — ignore une tentative de changement de statut', async () => {
      // Le statut relève des routes d'activation, pas de la modification de fiche.
      const user = await creerUtilisateur({ status: 'Bloqué' });

      await request(app)
        .put(`/api/admin/users/${user.id}`)
        .set('Authorization', header)
        .send({ status: 'Actif', nom: 'Test' })
        .expect(200);

      assert.equal((await User.findById(user.id)).status, 'Bloqué');
    });

    test('PUT /api/admin/users/:id — 404 si le compte n\'existe pas', async () => {
      await request(app)
        .put('/api/admin/users/64b5f0000000000000000000')
        .set('Authorization', header)
        .send({ nom: 'Fantome' })
        .expect(404);
    });

    test('PUT /api/admin/users/:id — interdit à un non-administrateur', async () => {
      const cible = await creerUtilisateur();
      const agent = await creerUtilisateur({ role: 'Agent', status: 'Actif', password: 'MotDePasse1' });
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: agent.email, password: 'MotDePasse1' });

      await request(app)
        .put(`/api/admin/users/${cible.id}`)
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ nom: 'Pirate' })
        .expect(403);
    });
  });
});
