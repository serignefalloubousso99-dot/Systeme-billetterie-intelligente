/**
 * Tests d'API — Création, recherche, filtrage et statistiques
 *
 * Cas couverts    : A9 à A19 (tableau de synthèse du livrable)
 * Fonctionnalités : F6 — Création de comptes et rejet des doublons
 *                   F9 — Recherche et filtrage
 *                   F10 — Tableau de bord statistique
 *
 * Le cahier des charges impose de pouvoir rechercher un utilisateur par son
 * e-mail, son numéro de téléphone ou son identifiant unique : les trois sont
 * couverts. La recherche par téléphone est traitée à part, car elle a révélé
 * une régression (§5.1 du livrable).
 *
 * Les statistiques sont vérifiées sur les trois statuts, « Supprimé » compris —
 * c'est un chiffre explicitement demandé et il avait été oublié à l'affichage.
 *
 * Requêtes HTTP réelles via supertest, base de test isolée.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import {
  connectTestDb,
  disconnectTestDb,
  clearTestDb,
  creerUtilisateur,
  creerAdminEtToken,
} from '../helpers.js';

describe('API — Gestion des utilisateurs', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  const nouvelUtilisateur = {
    nom: 'Ndiaye',
    prenom: 'Moussa',
    email: 'moussa.ndiaye@test.com',
    telephone: '+221771111111',
    role: 'Agent',
  };

  test('POST /api/admin/users — crée un compte, bloqué par défaut', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', header)
      .send(nouvelUtilisateur)
      .expect(201);

    // Un compte fraîchement créé ne doit jamais être utilisable.
    assert.equal(res.body.user.status, 'Bloqué');
    assert.equal(res.body.user.role, 'Agent');
    assert.equal(res.body.user.password, undefined);
    assert.ok(res.body.user.id);
  });

  test('POST /api/admin/users — refuse un email déjà utilisé', async () => {
    await request(app).post('/api/admin/users').set('Authorization', header).send(nouvelUtilisateur);

    await request(app)
      .post('/api/admin/users')
      .set('Authorization', header)
      .send(nouvelUtilisateur)
      .expect(409);
  });

  test('POST /api/admin/users — refuse des champs obligatoires manquants', async () => {
    await request(app)
      .post('/api/admin/users')
      .set('Authorization', header)
      .send({ nom: 'Seul' })
      .expect(400);
  });

  test('GET /api/admin/users — renvoie un tableau', async () => {
    await creerUtilisateur({ email: 'a@test.com' });
    const res = await request(app).get('/api/admin/users').set('Authorization', header).expect(200);

    assert.ok(Array.isArray(res.body), 'la réponse doit être un tableau');
  });

  describe('Recherche et filtrage', () => {
    beforeEach(async () => {
      await creerUtilisateur({
        nom: 'Fall', prenom: 'Awa', email: 'awa.fall@test.com',
        telephone: '+221772222222', role: 'Agent', status: 'Actif',
      });
      await creerUtilisateur({
        nom: 'Sow', prenom: 'Ibrahima', email: 'ibrahima.sow@test.com',
        telephone: '+221773333333', role: 'Client', status: 'Bloqué',
      });
    });

    test('recherche par adresse e-mail', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=awa.fall@test.com')
        .set('Authorization', header)
        .expect(200);

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].email, 'awa.fall@test.com');
    });

    test('recherche par numéro de téléphone commençant par +', async () => {
      // Régression : le '+' non échappé provoquait une erreur 500.
      const res = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent('+221772222222')}`)
        .set('Authorization', header)
        .expect(200);

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].telephone, '+221772222222');
    });

    test('recherche par identifiant unique', async () => {
      const cree = await creerUtilisateur({ email: 'cible@test.com' });
      const res = await request(app)
        .get(`/api/admin/users?search=${cree.id}`)
        .set('Authorization', header)
        .expect(200);

      assert.ok(res.body.some((u) => u.id === cree.id));
    });

    test('filtre par rôle', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=Agent')
        .set('Authorization', header)
        .expect(200);

      assert.ok(res.body.length > 0);
      assert.ok(res.body.every((u) => u.role === 'Agent'));
    });

    test('filtre par statut', async () => {
      const res = await request(app)
        .get('/api/admin/users?status=Bloqu%C3%A9')
        .set('Authorization', header)
        .expect(200);

      assert.ok(res.body.every((u) => u.status === 'Bloqué'));
    });

    test('combine les filtres rôle et statut', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=Client&status=Bloqu%C3%A9')
        .set('Authorization', header)
        .expect(200);

      assert.ok(res.body.every((u) => u.role === 'Client' && u.status === 'Bloqué'));
    });
  });

  describe('Tableau de bord', () => {
    test('GET /api/admin/dashboard/stats — ventile par rôle et par statut', async () => {
      await creerUtilisateur({ role: 'Agent', status: 'Actif', email: 'ag1@test.com' });
      await creerUtilisateur({ role: 'Client', status: 'Bloqué', email: 'cl1@test.com' });
      await creerUtilisateur({ role: 'Client', status: 'Supprimé', email: 'cl2@test.com' });

      const res = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', header)
        .expect(200);

      const { stats } = res.body;
      assert.equal(typeof stats.total, 'number');
      // Les 3 statuts exigés doivent être présents, y compris « Supprimé ».
      assert.equal(typeof stats.byStatus['Actif'], 'number');
      assert.equal(typeof stats.byStatus['Bloqué'], 'number');
      assert.equal(typeof stats.byStatus['Supprimé'], 'number');
      assert.equal(stats.byRole.Client.total, 2);
      assert.equal(stats.byRole.Client['Supprimé'], 1);
    });
  });
});
