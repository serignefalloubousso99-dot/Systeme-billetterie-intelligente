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
  enteteClient,
  creerTitreSimpleTest,
  creerTitreAbonnementTest,
  Validation,
} from '../helpers.js';

describe('API — Scan et Validation des Titres de Transport', () => {
  before(async () => {
    await preparerBase();
  });

  beforeEach(async () => {
    await viderBase();
  });

  after(async () => {
    await fermerBase();
  });

  describe('Validation Ticket Simple', () => {
    it('autorise le premier voyage et consomme définitivement le ticket', async () => {
      const ticket = await creerTitreSimpleTest();

      const res = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique });

      assert.equal(res.status, 200);
      assert.equal(res.body.autorise, true);
      assert.equal(res.body.validation.resultat, 'AUTORISE');
      assert.equal(res.body.validation.motifRefus, null);

      // Rechargement du ticket en base : doit être CONSOMME
      await ticket.reload();
      assert.equal(ticket.statut, 'CONSOMME');
      assert.ok(ticket.consommeLe !== null);
    });

    it('refuse toute réutilisation d’un ticket déjà utilisé avec le motif exact', async () => {
      const ticket = await creerTitreSimpleTest();

      // 1er scan : autorisé
      await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique });

      // 2nd scan : refusé
      const res2 = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.autorise, false);
      assert.equal(res2.body.motifRefus, 'TICKET_DEJA_UTILISE');
      assert.equal(res2.body.validation.resultat, 'REFUSE');
      assert.equal(res2.body.validation.motifRefus, 'TICKET_DEJA_UTILISE');
    });
  });

  describe('Cas de refus normés', () => {
    it('refuse un QR Code inconnu avec le motif QR_CODE_INCONNU', async () => {
      const res = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: 'TKT-INEXISTANT-9999' });

      assert.equal(res.status, 200);
      assert.equal(res.body.autorise, false);
      assert.equal(res.body.motifRefus, 'QR_CODE_INCONNU');
      assert.equal(res.body.validation.resultat, 'REFUSE');
    });

    it('refuse un QR Code désactivé avec le motif QR_CODE_DESACTIVE', async () => {
      const ticket = await creerTitreSimpleTest({ statut: 'DESACTIVE' });

      const res = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique });

      assert.equal(res.status, 200);
      assert.equal(res.body.autorise, false);
      assert.equal(res.body.motifRefus, 'QR_CODE_DESACTIVE');
    });

    it('refuse un titre expiré avec le motif ABONNEMENT_EXPIRE', async () => {
      const ticket = await creerTitreSimpleTest({ dateExpiration: '2020-01-01' });

      const res = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique });

      assert.equal(res.status, 200);
      assert.equal(res.body.autorise, false);
      assert.equal(res.body.motifRefus, 'ABONNEMENT_EXPIRE');
    });
  });

  describe('Contrôle d’accès au scan', () => {
    it('autorise un agent et un administrateur à effectuer le scan', async () => {
      const t1 = await creerTitreSimpleTest();
      const t2 = await creerTitreSimpleTest();

      const resAgent = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: t1.codeUnique });
      assert.equal(resAgent.status, 200);

      const resAdmin = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAdmin())
        .send({ code: t2.codeUnique });
      assert.equal(resAdmin.status, 200);
    });

    it('interdit le scan à un compte client simple', async () => {
      const ticket = await creerTitreSimpleTest();
      const res = await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteClient())
        .send({ code: ticket.codeUnique });

      assert.equal(res.status, 403);
    });
  });

  describe('Consultation de l’historique des validations', () => {
    it('liste les validations et permet le filtrage par résultat', async () => {
      const t1 = await creerTitreSimpleTest();
      await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: t1.codeUnique });

      await request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: 'CODE-FAUX' });

      const resTous = await request(app).get('/api/billetterie/validations').set(enteteAgent());
      assert.equal(resTous.status, 200);
      assert.equal(resTous.body.length, 2);

      const resRefus = await request(app)
        .get('/api/billetterie/validations?resultat=REFUSE')
        .set(enteteAgent());
      assert.equal(resRefus.status, 200);
      assert.equal(resRefus.body.length, 1);
      assert.equal(resRefus.body[0].resultat, 'REFUSE');
    });
  });
});
