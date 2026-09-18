/**
 * Tests d'API — Authentification et contrôle d'accès
 *
 * Cas couverts    : A1 à A8 (tableau de synthèse du livrable)
 * Fonctionnalités : F1 — Authentification JWT (porte d'entrée du service)
 *                   F2 — Contrôle d'accès administrateur
 *
 * Ce sont les deux fonctions les plus critiques : une faille sur F2 laisserait
 * un Agent ou un Client administrer l'ensemble des comptes. On vérifie donc
 * les trois barrières successives — jeton absent, jeton invalide, rôle
 * insuffisant — en plus du cas passant.
 *
 * Requêtes HTTP réelles via supertest, contre une base de test isolée
 * (voir helpers.js). Aucun port réseau n'est ouvert.
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

describe('API — Authentification et contrôle d\'accès', () => {
  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(clearTestDb);

  test('POST /api/auth/login — connecte un compte actif et renvoie un jeton', async () => {
    const user = await creerUtilisateur({ status: 'Actif', password: 'MotDePasse1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'MotDePasse1' })
      .expect(200);

    assert.ok(res.body.token, 'un jeton JWT doit être renvoyé');
    assert.equal(res.body.user.email, user.email);
    assert.equal(res.body.user.password, undefined, 'le mot de passe ne doit jamais transiter');
  });

  test('POST /api/auth/login — refuse un mot de passe erroné', async () => {
    const user = await creerUtilisateur({ status: 'Actif', password: 'MotDePasse1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'MauvaisMotDePasse' })
      .expect(401);

    assert.ok(res.body.token === undefined);
  });

  test('POST /api/auth/login — refuse un compte non actif', async () => {
    // Un compte créé mais jamais activé ne doit pas pouvoir se connecter.
    const user = await creerUtilisateur({ status: 'Bloqué', password: 'MotDePasse1' });

    await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'MotDePasse1' })
      .expect(403);
  });

  test('GET /api/admin/users — rejette une requête sans jeton', async () => {
    await request(app).get('/api/admin/users').expect(401);
  });

  test('GET /api/admin/users — rejette un jeton invalide', async () => {
    await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer jeton.completement.invalide')
      .expect(401);
  });

  test('GET /api/admin/users — interdit l\'accès à un non-administrateur', async () => {
    // Un Agent authentifié ne doit pas pouvoir administrer les comptes.
    const agent = await creerUtilisateur({ role: 'Agent', status: 'Actif', password: 'MotDePasse1' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: agent.email, password: 'MotDePasse1' });

    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(403);
  });

  test('GET /api/admin/users — autorise un administrateur', async () => {
    const { header } = await creerAdminEtToken(request, app);
    await request(app).get('/api/admin/users').set('Authorization', header).expect(200);
  });

  test('POST /api/auth/logout — répond correctement', async () => {
    await request(app).post('/api/auth/logout').expect(200);
  });
});
