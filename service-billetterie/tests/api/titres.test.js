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
  AuditLog,
} from '../helpers.js';

describe('API — Gestion des Titres de Transport et QR Codes', () => {
  before(async () => {
    await preparerBase();
  });

  beforeEach(async () => {
    await viderBase();
  });

  after(async () => {
    await fermerBase();
  });

  describe('Création et génération de titre (POST /api/billetterie/titres)', () => {
    it('génère un titre de transport numérique et son QR code avec succès', async () => {
      const res = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAdmin())
        .send({
          utilisateurId: '6a5b68fc8be4efac6e1a7001',
          typeTitre: 'TICKET_SIMPLE',
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.titre, 'La réponse doit contenir l’objet titre');
      assert.equal(res.body.titre.statut, 'ACTIF');
      assert.equal(res.body.titre.typeTitre, 'TICKET_SIMPLE');
      assert.ok(res.body.titre.codeUnique.startsWith('TKT-'));
      assert.ok(res.body.titre.qrCodeData.startsWith('data:image/png;base64,'));

      // Vérification de la piste d'audit
      const audit = await AuditLog.findOne({ where: { ressourceId: res.body.titre.id } });
      assert.ok(audit, "Une entrée d'audit doit être enregistrée");
      assert.equal(audit.action, 'GENERATION_TITRE');
    });

    it('refuse la création sans identifiant utilisateur', async () => {
      const res = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAdmin())
        .send({ typeTitre: 'TICKET_SIMPLE' });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /utilisateurId/i);
    });

    it('refuse un type de titre invalide', async () => {
      const res = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAdmin())
        .send({
          utilisateurId: '6a5b68fc8be4efac6e1a7001',
          typeTitre: 'PASS_MAGIQUE',
        });

      assert.equal(res.status, 400);
    });

    it('exige un abonnementId pour les types LIMITE et ILLIMITE', async () => {
      const res = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAdmin())
        .send({
          utilisateurId: '6a5b68fc8be4efac6e1a7001',
          typeTitre: 'LIMITE',
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /abonnementId/i);
    });

    it('interdit la génération aux agents et aux clients non administrateurs', async () => {
      const resAgent = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteAgent())
        .send({ utilisateurId: '6a5b68fc8be4efac6e1a7001', typeTitre: 'TICKET_SIMPLE' });

      assert.equal(resAgent.status, 403);

      const resClient = await request(app)
        .post('/api/billetterie/titres')
        .set(enteteClient())
        .send({ utilisateurId: '6a5b68fc8be4efac6e1a7001', typeTitre: 'TICKET_SIMPLE' });

      assert.equal(resClient.status, 403);
    });
  });

  describe('Consultation et filtrage (GET /api/billetterie/titres)', () => {
    it('liste les titres et autorise la consultation par un agent', async () => {
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7001' });
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7002' });

      const res = await request(app).get('/api/billetterie/titres').set(enteteAgent());

      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.body), true);
      assert.equal(res.body.length, 2);
    });

    it('filtre par utilisateurId et par statut', async () => {
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7001', statut: 'ACTIF' });
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7001', statut: 'DESACTIVE' });
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7002', statut: 'ACTIF' });

      const res = await request(app)
        .get('/api/billetterie/titres?utilisateurId=6a5b68fc8be4efac6e1a7001&statut=ACTIF')
        .set(enteteAdmin());

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].statut, 'ACTIF');
    });
  });

  describe('Titres d’un client (GET /api/billetterie/titres/client/:utilisateurId)', () => {
    it('autorise un client à consulter ses propres titres', async () => {
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7001' });

      const res = await request(app)
        .get('/api/billetterie/titres/client/6a5b68fc8be4efac6e1a7001')
        .set(enteteClient());

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
    });

    it('interdit à un client de consulter les titres d’un autre', async () => {
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7002' });

      const res = await request(app)
        .get('/api/billetterie/titres/client/6a5b68fc8be4efac6e1a7002')
        .set(enteteClient());

      assert.equal(res.status, 403);
    });

    it('autorise les agents et administrateurs sur n’importe quel client', async () => {
      await creerTitreSimpleTest({ utilisateurId: '6a5b68fc8be4efac6e1a7002' });

      const res = await request(app)
        .get('/api/billetterie/titres/client/6a5b68fc8be4efac6e1a7002')
        .set(enteteAgent());

      assert.equal(res.status, 200);
    });
  });

  describe('Activation et désactivation (PATCH /api/billetterie/titres/:id/statut)', () => {
    it('désactive puis réactive un titre et trace l’action dans l’audit', async () => {
      const titre = await creerTitreSimpleTest();

      // 1. Désactivation
      const resDesact = await request(app)
        .patch(`/api/billetterie/titres/${titre.id}/statut`)
        .set(enteteAdmin())
        .send({ statut: 'DESACTIVE' });

      assert.equal(resDesact.status, 200);
      assert.equal(resDesact.body.titre.statut, 'DESACTIVE');

      // 2. Réactivation
      const resReact = await request(app)
        .patch(`/api/billetterie/titres/${titre.id}/statut`)
        .set(enteteAdmin())
        .send({ statut: 'ACTIF' });

      assert.equal(resReact.status, 200);
      assert.equal(resReact.body.titre.statut, 'ACTIF');

      // Vérifier les 2 audits
      const audits = await AuditLog.findAll({ where: { ressourceId: titre.id } });
      assert.equal(audits.length, 2);
      assert.ok(audits.some((a) => a.action === 'DESACTIVATION_TITRE'));
      assert.ok(audits.some((a) => a.action === 'ACTIVATION_TITRE'));
    });

    it('refuse une valeur de statut arbitraire', async () => {
      const titre = await creerTitreSimpleTest();
      const res = await request(app)
        .patch(`/api/billetterie/titres/${titre.id}/statut`)
        .set(enteteAdmin())
        .send({ statut: 'SUPPRIME' });

      assert.equal(res.status, 400);
    });
  });
});
