/**
 * Tests d'API — GET /api/users/lookup
 *
 * Identité minimale (nom, prénom, téléphone) de plusieurs comptes, utilisée
 * par le Service Billetterie pour afficher un nom lisible à la place d'un
 * identifiant MongoDB (ex : client d'un titre, agent d'une validation).
 *
 * Contrairement à GET /api/admin/users, accessible aux agents (pas aux
 * clients), et ne renvoie jamais l'email, le rôle ou le statut.
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
} from '../helpers.js';

const login = async (email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return `Bearer ${res.body.token}`;
};

describe('API — Identité minimale (GET /api/users/lookup)', () => {
  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(clearTestDb);

  test('renvoie nom/prénom/téléphone sans champs sensibles, pour un agent', async () => {
    const client = await creerUtilisateur({ nom: 'Fall', prenom: 'Awa', role: 'Client' });
    const agent = await creerUtilisateur({ role: 'Agent', password: 'AgentTest1' });
    const header = await login(agent.email, 'AgentTest1');

    const res = await request(app)
      .get(`/api/users/lookup?ids=${client.id}`)
      .set('Authorization', header);

    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 1);
    const u = res.body.users[0];
    assert.equal(u.nom, 'Fall');
    assert.equal(u.prenom, 'Awa');
    assert.equal(u.email, undefined, "l'email ne doit jamais être exposé ici");
    assert.equal(u.role, undefined, 'le rôle ne doit jamais être exposé ici');
  });

  test('interdit l\'accès à un client', async () => {
    const autre = await creerUtilisateur();
    const client = await creerUtilisateur({ role: 'Client', password: 'ClientTest1' });
    const header = await login(client.email, 'ClientTest1');

    const res = await request(app)
      .get(`/api/users/lookup?ids=${autre.id}`)
      .set('Authorization', header);

    assert.equal(res.status, 403);
  });

  test('exige une authentification', async () => {
    const res = await request(app).get('/api/users/lookup?ids=64b5f0000000000000000000');
    assert.equal(res.status, 401);
  });

  test('ignore les identifiants mal formés et renvoie un tableau vide sans ids valides', async () => {
    const admin = await creerUtilisateur({ role: 'Administrateur', password: 'AdminTest1' });
    const header = await login(admin.email, 'AdminTest1');

    const res = await request(app)
      .get('/api/users/lookup?ids=pas-un-id,64b5f0000000000000000000')
      .set('Authorization', header);

    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 0);
  });
});
