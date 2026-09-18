import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import {
  preparerBase,
  viderBase,
  fermerBase,
  enteteAdmin,
  enteteAgent,
  creerTitreSimpleTest,
} from '../helpers.js';

describe('API — Audit et Tableau de bord / Statistiques', () => {
  before(async () => {
    await preparerBase();
  });

  beforeEach(async () => {
    await viderBase();
  });

  after(async () => {
    await fermerBase();
  });

  describe('Piste d’audit (GET /api/billetterie/audit)', () => {
    it('enregistre et liste les audits des actions sensibles', async () => {
      // Génère un titre via l'API (déclenche un audit)
      await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAdmin())
        .send({ utilisateurId: '6a5b68fc8be4efac6e1a7001', typeTitre: 'TICKET_SIMPLE' });

      const res = await request(app).get('/api/billetterie/audit').set(enteteAdmin());

      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.body), true);
      assert.ok(res.body.length >= 1);
      assert.equal(res.body[0].action, 'GENERATION_TITRE');
    });

    it('interdit l’accès à la piste d’audit aux agents', async () => {
      const res = await request(app).get('/api/billetterie/audit').set(enteteAgent());
      assert.equal(res.status, 403);
    });
  });

  describe('Tableau de bord et Statistiques (GET /api/billetterie/dashboard/stats)', () => {
    it('calcule et renvoie tous les indicateurs décisionnels', async () => {
      // 1 titre actif
      const t1 = await creerTitreSimpleTest();
      // Scan autorisé
      await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: t1.codeUnique });

      // Scan refusé
      await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: 'CODE-INCONNU' });

      const res = await request(app)
        .get('/api/billetterie/dashboard/stats')
        .set(enteteAdmin());

      assert.equal(res.status, 200);
      const { stats } = res.body;

      assert.ok(stats, 'L’objet stats doit être présent');
      assert.equal(stats.totalTitres, 1);
      assert.equal(stats.totalValidations, 2);
      assert.equal(stats.autorises, 1);
      assert.equal(stats.refuses, 1);
      assert.equal(stats.tauxSucces, 50);
      assert.equal(stats.refusParMotif.QR_CODE_INCONNU, 1);
      assert.ok(stats.validationsParHeure, 'La distribution horaire doit être présente');
    });

    it('réserve les statistiques aux administrateurs', async () => {
      const res = await request(app)
        .get('/api/billetterie/dashboard/stats')
        .set(enteteAgent());
      assert.equal(res.status, 403);
    });
  });
});
