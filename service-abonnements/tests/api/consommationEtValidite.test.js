/**
 * Tests d'API — Validation d'un voyage, historique et droit à voyager
 *
 * Contrat : PLAN-SERVICE-ABONNEMENTS.md §4.3 et §4.4
 * Fonctionnalités : décompte des voyages et vérification du droit à monter.
 *
 * Ce sont les endpoints que consommera le Service Billetterie à chaque scan
 * de QR Code. Deux protections y sont critiques : l'unicité de la validation
 * (un scan rejoué ne doit pas décompter deux fois) et l'atomicité du décompte
 * (deux scans simultanés ne doivent pas dépasser le solde).
 */
import '../helpers.js';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import {
  preparerBase,
  viderBase,
  fermerBase,
  enteteAdmin,
  jetonPour,
  dans,
  identifiantClient,
  Abonnement,
  creerFormuleLimitee,
  creerFormuleTicket,
  creerFormuleIllimitee,
  creerAbonnement,
} from '../helpers.js';

const URL = '/api/abonnements/souscriptions';
const VALIDITE = '/api/abonnements/validite';

// Hooks au niveau du fichier : la connexion est partagée par les deux suites.
// Les placer dans chaque `describe` ferait fermer la base par la première,
// laissant la seconde sans connexion.
before(preparerBase);
after(fermerBase);
beforeEach(viderBase);

describe('API — Consommation d’un voyage', () => {

  test('décompte un voyage et met le solde à jour', async () => {
    const formule = await creerFormuleLimitee();
    const abonnement = await creerAbonnement(formule, { voyagesAutorises: 3 });

    const res = await request(app).post(`${URL}/${abonnement.id}/consommer`)
      .set(enteteAdmin()).send({ validationId: 'VAL-001' }).expect(200);

    assert.equal(res.body.abonnement.voyagesRestants, 2);
    assert.equal(res.body.consommation.validationId, 'VAL-001');
  });

  test('bascule en EPUISE au dernier voyage, puis refuse', async () => {
    const formule = await creerFormuleLimitee();
    const abonnement = await creerAbonnement(formule, { voyagesAutorises: 1 });

    const dernier = await request(app).post(`${URL}/${abonnement.id}/consommer`)
      .set(enteteAdmin()).send({ validationId: 'A' }).expect(200);
    assert.equal(dernier.body.abonnement.statut, 'EPUISE');

    const refus = await request(app).post(`${URL}/${abonnement.id}/consommer`)
      .set(enteteAdmin()).send({ validationId: 'B' }).expect(409);
    assert.match(refus.body.message, /épuisé/i);
  });

  test('refuse un scan rejoué sans décompter deux fois', async () => {
    const formule = await creerFormuleLimitee();
    const abonnement = await creerAbonnement(formule, { voyagesAutorises: 10 });

    await request(app).post(`${URL}/${abonnement.id}/consommer`).set(enteteAdmin()).send({ validationId: 'SCAN-X' }).expect(200);
    await request(app).post(`${URL}/${abonnement.id}/consommer`).set(enteteAdmin()).send({ validationId: 'SCAN-X' }).expect(409);

    const apres = await Abonnement.findByPk(abonnement.id);
    assert.equal(apres.voyagesConsommes, 1, 'le solde ne doit pas avoir bougé deux fois');
  });

  test('ne dépasse jamais le solde, même sur des scans simultanés', async () => {
    // Sans transaction ni verrou de ligne, les cinq requêtes passeraient la
    // vérification avant qu'aucune n'ait décrémenté.
    const formule = await creerFormuleLimitee();
    const abonnement = await creerAbonnement(formule, { voyagesAutorises: 3 });

    const reponses = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        request(app).post(`${URL}/${abonnement.id}/consommer`).set(enteteAdmin()).send({ validationId: `C${i}` })
      )
    );

    assert.equal(reponses.filter((r) => r.status === 200).length, 3);
    assert.equal(reponses.filter((r) => r.status === 409).length, 2);

    const apres = await Abonnement.findByPk(abonnement.id);
    assert.equal(apres.voyagesConsommes, 3);
  });

  test('indique le motif exact du refus', async () => {
    const formule = await creerFormuleLimitee();
    const expire = await creerAbonnement(formule, { dateDebut: dans(-60), dateExpiration: dans(-1) });
    const suspendu = await creerAbonnement(formule, { utilisateurId: identifiantClient(2), statut: 'SUSPENDU' });
    const resilie = await creerAbonnement(formule, { utilisateurId: identifiantClient(3), statut: 'RESILIE' });

    const a = await request(app).post(`${URL}/${expire.id}/consommer`).set(enteteAdmin()).send({ validationId: 'E' }).expect(409);
    assert.match(a.body.message, /expiré/i);

    const b = await request(app).post(`${URL}/${suspendu.id}/consommer`).set(enteteAdmin()).send({ validationId: 'S' }).expect(409);
    assert.match(b.body.message, /suspendu/i);

    const c = await request(app).post(`${URL}/${resilie.id}/consommer`).set(enteteAdmin()).send({ validationId: 'R' }).expect(409);
    assert.match(c.body.message, /résilié/i);
  });

  test('historise les voyages d’un illimité sans jamais le bloquer', async () => {
    const formule = await creerFormuleIllimitee();
    const abonnement = await creerAbonnement(formule, { voyagesAutorises: null });

    for (let i = 1; i <= 5; i++) {
      await request(app).post(`${URL}/${abonnement.id}/consommer`).set(enteteAdmin()).send({ validationId: `I${i}` }).expect(200);
    }

    const fiche = await request(app).get(`${URL}/${abonnement.id}`).set(enteteAdmin()).expect(200);
    assert.equal(fiche.body.abonnement.statut, 'ACTIF');
    assert.equal(fiche.body.abonnement.voyagesRestants, null);

    const historique = await request(app).get(`${URL}/${abonnement.id}/historique`).set(enteteAdmin()).expect(200);
    assert.equal(historique.body.length, 5);
  });

  test('exige un identifiant de validation', async () => {
    const formule = await creerFormuleLimitee();
    const abonnement = await creerAbonnement(formule);
    await request(app).post(`${URL}/${abonnement.id}/consommer`).set(enteteAdmin()).send({}).expect(400);
  });

  test('renvoie 404 sur un abonnement inexistant', async () => {
    await request(app).post(`${URL}/9999/consommer`).set(enteteAdmin()).send({ validationId: 'Z' }).expect(404);
    await request(app).get(`${URL}/9999/historique`).set(enteteAdmin()).expect(404);
  });
});

describe('API — Droit à voyager', () => {
  test('renvoie exactement les trois champs du contrat', async () => {
    const formule = await creerFormuleLimitee();
    const client = identifiantClient(1);
    await creerAbonnement(formule, { utilisateurId: client, voyagesConsommes: 3 });

    const res = await request(app).get(`${VALIDITE}/${client}`).set(enteteAdmin()).expect(200);

    assert.equal(res.body.valide, true);
    assert.deepEqual(Object.keys(res.body.abonnement).sort(), ['dateExpiration', 'id', 'voyagesRestants']);
    assert.equal(res.body.abonnement.voyagesRestants, 17);
  });

  test('refuse quand aucun titre n’est utilisable', async () => {
    const formule = await creerFormuleLimitee();

    const inconnu = await request(app).get(`${VALIDITE}/${identifiantClient(9)}`).set(enteteAdmin()).expect(200);
    assert.equal(inconnu.body.valide, false);
    assert.equal(inconnu.body.abonnement, null);

    const clientExpire = identifiantClient(2);
    await creerAbonnement(formule, { utilisateurId: clientExpire, dateDebut: dans(-60), dateExpiration: dans(-1) });
    const expire = await request(app).get(`${VALIDITE}/${clientExpire}`).set(enteteAdmin()).expect(200);
    assert.equal(expire.body.valide, false);

    const clientEpuise = identifiantClient(3);
    await creerAbonnement(formule, { utilisateurId: clientEpuise, voyagesAutorises: 2, voyagesConsommes: 2 });
    const epuise = await request(app).get(`${VALIDITE}/${clientEpuise}`).set(enteteAdmin()).expect(200);
    assert.equal(epuise.body.valide, false);
  });

  test('retient le titre qui expire le plus tôt', async () => {
    // Sinon un ticket de courte durée périmerait sans avoir servi, alors
    // qu'un abonnement valable un mois restait disponible.
    const abonnementMensuel = await creerFormuleLimitee();
    const ticket = await creerFormuleTicket();
    const client = identifiantClient(1);

    await creerAbonnement(abonnementMensuel, { utilisateurId: client, dateExpiration: dans(30) });
    await creerAbonnement(ticket, { utilisateurId: client, dateExpiration: dans(2) });

    const res = await request(app).get(`${VALIDITE}/${client}`).set(enteteAdmin()).expect(200);
    assert.ok(res.body.abonnement.dateExpiration.startsWith(dans(2)));
  });

  test('ouvre la vérification aux agents, à soi-même, mais pas à un autre client', async () => {
    const client = identifiantClient(1);
    // Le contrôle se fait sur le terrain : c'est l'agent qui scanne.
    await request(app).get(`${VALIDITE}/${client}`).set({ Authorization: jetonPour('Agent') }).expect(200);
    // Un client peut consulter son propre abonnement...
    await request(app).get(`${VALIDITE}/${client}`).set({ Authorization: jetonPour('Client', client) }).expect(200);
    // ...mais pas interroger la situation d'un autre.
    await request(app).get(`${VALIDITE}/${client}`).set({ Authorization: jetonPour('Client') }).expect(403);
    await request(app).get(`${VALIDITE}/${client}`).expect(401);
  });
});
