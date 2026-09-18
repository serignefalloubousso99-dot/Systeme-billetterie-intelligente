import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import {
  preparerBase,
  viderBase,
  fermerBase,
  enteteAgent,
  creerTitreSimpleTest,
  Validation,
} from '../helpers.js';

describe('API — Concurrence et Scans Simultanés', () => {
  before(async () => {
    await preparerBase();
  });

  beforeEach(async () => {
    await viderBase();
  });

  after(async () => {
    await fermerBase();
  });

  it('empêche deux scans simultanés de consommer deux fois le même ticket simple', async () => {
    const ticket = await creerTitreSimpleTest();

    // Déclenchement de 2 scans rigoureusement en parallèle
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique }),
      request(app)
        .post('/api/billetterie/validations/scan')
        .set(enteteAgent())
        .send({ code: ticket.codeUnique }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    const reponses = [res1.body, res2.body];
    const autorises = reponses.filter((r) => r.autorise === true);
    const refuses = reponses.filter((r) => r.autorise === false);

    // Exactement UN voyage autorisé et UN voyage refusé
    assert.equal(autorises.length, 1, 'Exactement un scan doit être autorisé');
    assert.equal(refuses.length, 1, 'Le scan concurrent doit être refusé');
    assert.equal(refuses[0].motifRefus, 'TICKET_DEJA_UTILISE');

    // Vérification de la cohérence en base de données
    const validations = await Validation.findAll({ where: { titreId: ticket.id } });
    assert.equal(validations.length, 2);

    const nbAutorises = validations.filter((v) => v.resultat === 'AUTORISE').length;
    const nbRefuses = validations.filter((v) => v.resultat === 'REFUSE').length;
    assert.equal(nbAutorises, 1);
    assert.equal(nbRefuses, 1);
  });
});
