/**
 * Tests d'API — Souscription et cycle de vie
 *
 * Contrat : PLAN-SERVICE-ABONNEMENTS.md §4.2
 * Fonctionnalités : règles actées « un seul abonnement en cours, sauf tickets
 * simples » et « statut calculé à la lecture ».
 *
 * Le filtrage par statut mérite une attention particulière : les statuts
 * EXPIRE et EPUISE n'étant pas stockés en temps réel, filtrer directement en
 * SQL remonterait des abonnements périmés comme encore actifs.
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
  dans,
  identifiantClient,
  creerFormuleLimitee,
  creerFormuleTicket,
  creerFormuleIllimitee,
  creerAbonnement,
} from '../helpers.js';

const URL = '/api/abonnements/souscriptions';

describe('API — Souscriptions', () => {
  before(preparerBase);
  after(fermerBase);
  beforeEach(viderBase);

  describe('Souscription', () => {
    test('calcule l’expiration et les compteurs depuis la formule', async () => {
      const formule = await creerFormuleLimitee();
      const res = await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: identifiantClient(1), formuleId: formule.id, dateDebut: dans(0) })
        .expect(201);

      const { abonnement } = res.body;
      // dateExpiration est désormais un horodatage complet (précision à
      // l'heure) : on vérifie le jour calendaire attendu, pas l'heure exacte.
      assert.ok(abonnement.dateExpiration.startsWith(dans(30)));
      assert.equal(abonnement.voyagesAutorises, 20);
      assert.equal(abonnement.voyagesRestants, 20);
      assert.equal(abonnement.statut, 'ACTIF');
      // Le contrat impose la formule imbriquée dans la réponse.
      assert.equal(abonnement.formule.type, 'LIMITE');
    });

    test('refuse une saisie invalide ou une formule inconnue', async () => {
      const formule = await creerFormuleLimitee();
      await request(app).post(URL).set(enteteAdmin()).send({ utilisateurId: identifiantClient(1) }).expect(400);
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: identifiantClient(1), formuleId: formule.id, dateDebut: '19/07/2026' }).expect(400);
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: identifiantClient(1), formuleId: 9999, dateDebut: dans(0) }).expect(404);
    });

    test('refuse une formule retirée du catalogue', async () => {
      const formule = await creerFormuleLimitee({ actif: false });
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: identifiantClient(1), formuleId: formule.id, dateDebut: dans(0) }).expect(409);
    });
  });

  describe('Règle : un seul abonnement en cours', () => {
    test('refuse un second abonnement limité ou illimité', async () => {
      const limitee = await creerFormuleLimitee();
      const illimitee = await creerFormuleIllimitee();
      const client = identifiantClient(1);
      await creerAbonnement(limitee, { utilisateurId: client });

      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: client, formuleId: limitee.id, dateDebut: dans(0) }).expect(409);
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: client, formuleId: illimitee.id, dateDebut: dans(0) }).expect(409);
    });

    test('autorise plusieurs tickets simples, même avec un abonnement en cours', async () => {
      const limitee = await creerFormuleLimitee();
      const ticket = await creerFormuleTicket();
      const client = identifiantClient(1);
      await creerAbonnement(limitee, { utilisateurId: client });

      // C'est le principe du carnet de tickets.
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: client, formuleId: ticket.id, dateDebut: dans(0) }).expect(201);
      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: client, formuleId: ticket.id, dateDebut: dans(0) }).expect(201);
    });

    test('n’empêche pas un autre client de souscrire', async () => {
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule, { utilisateurId: identifiantClient(1) });

      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: identifiantClient(2), formuleId: formule.id, dateDebut: dans(0) }).expect(201);
    });

    test('laisse souscrire à nouveau une fois l’abonnement expiré', async () => {
      const formule = await creerFormuleLimitee();
      const client = identifiantClient(1);
      // Statut encore stocké à ACTIF alors que la date est passée : c'est
      // exactement la situation que le recalcul doit rattraper.
      await creerAbonnement(formule, { utilisateurId: client, dateDebut: dans(-60), dateExpiration: dans(-1) });

      await request(app).post(URL).set(enteteAdmin())
        .send({ utilisateurId: client, formuleId: formule.id, dateDebut: dans(0) }).expect(201);
    });
  });

  describe('Consultation et filtres', () => {
    test('rafraîchit les statuts avant de filtrer', async () => {
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule, { utilisateurId: identifiantClient(1) });
      await creerAbonnement(formule, {
        utilisateurId: identifiantClient(2), dateDebut: dans(-60), dateExpiration: dans(-1),
      });

      const expires = await request(app).get(`${URL}?statut=EXPIRE`).set(enteteAdmin()).expect(200);
      assert.equal(expires.body.length, 1, 'l’abonnement périmé doit ressortir comme EXPIRE');

      const actifs = await request(app).get(`${URL}?statut=ACTIF`).set(enteteAdmin()).expect(200);
      assert.equal(actifs.body.length, 1);
    });

    test('filtre par client et par type', async () => {
      const limitee = await creerFormuleLimitee();
      const ticket = await creerFormuleTicket();
      await creerAbonnement(limitee, { utilisateurId: identifiantClient(1) });
      await creerAbonnement(ticket, { utilisateurId: identifiantClient(2) });

      const parClient = await request(app).get(`${URL}?utilisateurId=${identifiantClient(1)}`).set(enteteAdmin()).expect(200);
      assert.equal(parClient.body.length, 1);

      const parType = await request(app).get(`${URL}?type=TICKET_SIMPLE`).set(enteteAdmin()).expect(200);
      assert.equal(parType.body.length, 1);
    });

    test('repère les abonnements expirant prochainement', async () => {
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule, { utilisateurId: identifiantClient(1), dateExpiration: dans(3) });
      await creerAbonnement(formule, { utilisateurId: identifiantClient(2), dateExpiration: dans(25) });

      const bientot = await request(app).get(`${URL}?expireSous=7`).set(enteteAdmin()).expect(200);
      assert.equal(bientot.body.length, 1);
    });

    test('refuse un filtre invalide', async () => {
      await request(app).get(`${URL}?statut=INCONNU`).set(enteteAdmin()).expect(400);
      await request(app).get(`${URL}?expireSous=abc`).set(enteteAdmin()).expect(400);
    });
  });

  describe('Cycle de vie', () => {
    test('suspend puis réactive', async () => {
      const formule = await creerFormuleLimitee();
      const abonnement = await creerAbonnement(formule);

      const suspendu = await request(app).patch(`${URL}/${abonnement.id}/statut`)
        .set(enteteAdmin()).send({ statut: 'SUSPENDU' }).expect(200);
      assert.equal(suspendu.body.abonnement.statut, 'SUSPENDU');

      const reactive = await request(app).patch(`${URL}/${abonnement.id}/statut`)
        .set(enteteAdmin()).send({ statut: 'ACTIF' }).expect(200);
      assert.equal(reactive.body.abonnement.statut, 'ACTIF');
    });

    test('interdit d’imposer un statut calculé', async () => {
      const formule = await creerFormuleLimitee();
      const abonnement = await creerAbonnement(formule);
      await request(app).patch(`${URL}/${abonnement.id}/statut`).set(enteteAdmin()).send({ statut: 'EXPIRE' }).expect(400);
      await request(app).patch(`${URL}/${abonnement.id}/statut`).set(enteteAdmin()).send({ statut: 'EPUISE' }).expect(400);
    });

    test('rend la résiliation définitive', async () => {
      const formule = await creerFormuleLimitee();
      const abonnement = await creerAbonnement(formule);
      await request(app).patch(`${URL}/${abonnement.id}/statut`).set(enteteAdmin()).send({ statut: 'RESILIE' }).expect(200);

      // Réactiver un contrat rompu contournerait la règle d'unicité.
      await request(app).patch(`${URL}/${abonnement.id}/statut`).set(enteteAdmin()).send({ statut: 'ACTIF' }).expect(409);
      await request(app).post(`${URL}/${abonnement.id}/renouveler`).set(enteteAdmin()).send({ dateDebut: dans(0) }).expect(409);
    });

    test('renouvelle en repartant d’une période neuve', async () => {
      const formule = await creerFormuleLimitee();
      const abonnement = await creerAbonnement(formule, {
        dateDebut: dans(-60), dateExpiration: dans(-1), voyagesConsommes: 18,
      });

      const res = await request(app).post(`${URL}/${abonnement.id}/renouveler`)
        .set(enteteAdmin()).send({ dateDebut: dans(0) }).expect(200);

      assert.equal(res.body.abonnement.statut, 'ACTIF');
      assert.equal(res.body.abonnement.voyagesConsommes, 0);
      assert.ok(res.body.abonnement.dateExpiration.startsWith(dans(30)));
    });

    test('refuse de renouveler un ticket simple', async () => {
      const ticket = await creerFormuleTicket();
      const abonnement = await creerAbonnement(ticket);
      await request(app).post(`${URL}/${abonnement.id}/renouveler`).set(enteteAdmin()).send({ dateDebut: dans(0) }).expect(409);
    });
  });
});
