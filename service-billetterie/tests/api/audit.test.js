/**
 * Tests d'API — Piste d'audit (GET /api/billetterie/audit)
 *
 * Exigence du sujet : le Service Billetterie doit conserver une piste
 * d'audit des opérations sensibles (qui, quelle action, sur quelle
 * ressource, quand, avec quel résultat). Couvre la génération/désactivation
 * de titres ET le scan — succès comme refus, puisqu'un refus (ticket déjà
 * utilisé, QR désactivé...) est lui aussi un événement à tracer.
 */
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
  AuditLog,
} from '../helpers.js';

describe('API — Piste d’audit', () => {
  before(preparerBase);
  beforeEach(viderBase);
  after(fermerBase);

  it('journalise la génération d’un titre avec auteur, rôle et horodatage', async () => {
    const res = await request(app)
      .post('/api/billetterie/titres')
      .set(enteteAdmin())
      .send({ utilisateurId: '6a5b68fc8be4efac6e1a7001', typeTitre: 'TICKET_SIMPLE' });

    const audit = await AuditLog.findOne({ where: { ressourceId: res.body.titre.id } });
    assert.ok(audit, 'une entrée d’audit doit être créée');
    assert.equal(audit.action, 'GENERATION_TITRE');
    assert.equal(audit.ressourceType, 'TITRE');
    assert.equal(audit.role, 'Administrateur');
    assert.equal(audit.resultat, 'SUCCES');
    assert.ok(audit.createdAt, 'la date et l’heure doivent être enregistrées');
  });

  it('journalise l’activation et la désactivation d’un titre', async () => {
    const titre = await creerTitreSimpleTest();

    await request(app)
      .patch(`/api/billetterie/titres/${titre.id}/statut`)
      .set(enteteAdmin())
      .send({ statut: 'DESACTIVE' });

    await request(app)
      .patch(`/api/billetterie/titres/${titre.id}/statut`)
      .set(enteteAdmin())
      .send({ statut: 'ACTIF' });

    const audits = await AuditLog.findAll({ where: { ressourceId: titre.id } });
    assert.equal(audits.length, 2);
    assert.ok(audits.some((a) => a.action === 'DESACTIVATION_TITRE'));
    assert.ok(audits.some((a) => a.action === 'ACTIVATION_TITRE'));
  });

  it('journalise un scan autorisé (SUCCES)', async () => {
    const titre = await creerTitreSimpleTest();

    const resScan = await request(app)
      .post('/api/billetterie/validations/scan')
      .set(enteteAgent())
      .send({ code: titre.codeUnique });

    const audit = await AuditLog.findOne({ where: { ressourceId: resScan.body.validation.id } });
    assert.ok(audit);
    assert.equal(audit.action, 'SCAN_VALIDATION');
    assert.equal(audit.resultat, 'SUCCES');
    assert.equal(audit.role, 'Agent');
  });

  it('journalise aussi un scan refusé (ECHEC), pas seulement les succès', async () => {
    const resScan = await request(app)
      .post('/api/billetterie/validations/scan')
      .set(enteteAgent())
      .send({ code: 'TKT-CODE-INEXISTANT' });

    const audit = await AuditLog.findOne({ where: { ressourceId: resScan.body.validation.id } });
    assert.ok(audit, 'un scan refusé doit aussi produire une entrée d’audit');
    assert.equal(audit.resultat, 'ECHEC');
    assert.equal(audit.details.motifRefus, 'QR_CODE_INCONNU');
  });

  it('réserve la consultation de la piste d’audit aux administrateurs', async () => {
    await request(app)
      .post('/api/billetterie/titres')
      .set(enteteAdmin())
      .send({ utilisateurId: '6a5b68fc8be4efac6e1a7001', typeTitre: 'TICKET_SIMPLE' });

    const resAgent = await request(app).get('/api/billetterie/audit').set(enteteAgent());
    assert.equal(resAgent.status, 403);

    const resAdmin = await request(app).get('/api/billetterie/audit').set(enteteAdmin());
    assert.equal(resAdmin.status, 200);
    assert.ok(resAdmin.body.length >= 1);
  });

  it('exige une authentification', async () => {
    const res = await request(app).get('/api/billetterie/audit');
    assert.equal(res.status, 401);
  });
});
