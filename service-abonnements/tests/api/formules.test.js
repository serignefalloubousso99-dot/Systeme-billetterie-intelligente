/**
 * Tests d'API — Catalogue des formules
 *
 * Contrat : PLAN-SERVICE-ABONNEMENTS.md §4.1
 * Fonctionnalité : configuration de l'offre commerciale.
 *
 * La règle la plus sensible est celle du tarif figé : dès qu'un client a
 * souscrit, les conditions financières ne bougent plus. Un test couvre
 * spécifiquement le cas du formulaire qui renvoie l'objet complet sans
 * modification réelle — il avait révélé un bug de comparaison.
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
  creerFormuleLimitee,
  creerAbonnement,
} from '../helpers.js';

const URL = '/api/abonnements/formules';

describe('API — Formules', () => {
  before(preparerBase);
  after(fermerBase);
  beforeEach(viderBase);

  describe('Création', () => {
    test('crée une formule conforme au contrat', async () => {
      const res = await request(app)
        .post(URL)
        .set(enteteAdmin())
        .send({
          nom: 'Mensuel 20',
          description: '30 jours',
          type: 'LIMITE',
          tarif: 15000,
          dureeValiditeJours: 30,
          nombreVoyages: 20,
        })
        .expect(201);

      const { formule } = res.body;
      assert.equal(formule.nom, 'Mensuel 20');
      assert.equal(formule.actif, true);
      // MariaDB renvoie les DECIMAL en chaîne : le contrat impose un nombre.
      assert.equal(typeof formule.tarif, 'number');
      assert.match(formule.creeLe, /^\d{4}-\d{2}-\d{2}$/);
    });

    test('force le nombre de voyages selon le type', async () => {
      const ticket = await request(app).post(URL).set(enteteAdmin())
        .send({ nom: 'Ticket', type: 'TICKET_SIMPLE', tarif: 500, dureeValiditeJours: 1 }).expect(201);
      assert.equal(ticket.body.formule.nombreVoyages, 1);

      const illimite = await request(app).post(URL).set(enteteAdmin())
        .send({ nom: 'Illimité', type: 'ILLIMITE', tarif: 50000, dureeValiditeJours: 30, nombreVoyages: 99 }).expect(201);
      // La valeur envoyée est ignorée : un illimité n'a pas de compteur.
      assert.equal(illimite.body.formule.nombreVoyages, null);
    });

    test('refuse une saisie invalide', async () => {
      await request(app).post(URL).set(enteteAdmin()).send({ nom: 'X' }).expect(400);
      await request(app).post(URL).set(enteteAdmin())
        .send({ nom: 'X', type: 'PREMIUM', tarif: 1, dureeValiditeJours: 1 }).expect(400);
      await request(app).post(URL).set(enteteAdmin())
        .send({ nom: 'X', type: 'ILLIMITE', tarif: -1, dureeValiditeJours: 1 }).expect(400);
    });
  });

  describe('Consultation', () => {
    test('renvoie un tableau simple, pas un objet enveloppe', async () => {
      await creerFormuleLimitee();
      const res = await request(app).get(URL).set(enteteAdmin()).expect(200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 1);
    });

    test('filtre par type et par activation', async () => {
      await creerFormuleLimitee();
      await creerFormuleLimitee({ nom: 'Retirée', actif: false });

      const limitees = await request(app).get(`${URL}?type=LIMITE`).set(enteteAdmin()).expect(200);
      assert.equal(limitees.body.length, 2);

      const actives = await request(app).get(`${URL}?actif=true`).set(enteteAdmin()).expect(200);
      assert.equal(actives.body.length, 1);
    });

    test('renvoie 404 pour une formule inexistante', async () => {
      await request(app).get(`${URL}/9999`).set(enteteAdmin()).expect(404);
    });
  });

  describe('Modification', () => {
    test('autorise tout tant que personne n’a souscrit', async () => {
      const formule = await creerFormuleLimitee();
      const res = await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin())
        .send({ nom: 'Mensuel 25', tarif: 18000, nombreVoyages: 25 }).expect(200);

      assert.equal(res.body.formule.tarif, 18000);
      assert.equal(res.body.formule.nombreVoyages, 25);
    });

    test('fige les conditions financières dès la première souscription', async () => {
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule);

      await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin()).send({ tarif: 20000 }).expect(409);
      await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin()).send({ dureeValiditeJours: 60 }).expect(409);
      await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin()).send({ nombreVoyages: 40 }).expect(409);

      const { Formule } = await import('../helpers.js');
      const inchangee = await Formule.findByPk(formule.id);
      assert.equal(Number(inchangee.tarif), 15000);
    });

    test('laisse renommer une formule souscrite', async () => {
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule);

      const res = await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin())
        .send({ nom: 'Nouveau nom', description: 'précisée' }).expect(200);
      assert.equal(res.body.formule.nom, 'Nouveau nom');
    });

    test('accepte l’objet complet renvoyé sans modification', async () => {
      // Cas réel du formulaire d'édition : il renvoie tous les champs, y
      // compris le tarif inchangé. Sans comparaison numérique, MariaDB
      // renvoyant "15000.00" là où le client envoie 15000, ce cas produisait
      // un 409 et empêchait tout renommage.
      const formule = await creerFormuleLimitee();
      await creerAbonnement(formule);

      await request(app).put(`${URL}/${formule.id}`).set(enteteAdmin()).send({
        nom: 'Renommée',
        description: 'màj',
        tarif: 15000,
        dureeValiditeJours: 30,
        nombreVoyages: 20,
      }).expect(200);
    });
  });

  describe('Activation', () => {
    test('retire et remet une formule au catalogue', async () => {
      const formule = await creerFormuleLimitee();

      const off = await request(app).patch(`${URL}/${formule.id}/actif`)
        .set(enteteAdmin()).send({ actif: false }).expect(200);
      assert.equal(off.body.formule.actif, false);

      const on = await request(app).patch(`${URL}/${formule.id}/actif`)
        .set(enteteAdmin()).send({ actif: true }).expect(200);
      assert.equal(on.body.formule.actif, true);
    });

    test('refuse une valeur non booléenne', async () => {
      const formule = await creerFormuleLimitee();
      await request(app).patch(`${URL}/${formule.id}/actif`).set(enteteAdmin()).send({ actif: 'oui' }).expect(400);
    });
  });

  describe('Contrôle d’accès', () => {
    test('exige un jeton', async () => {
      await request(app).get(URL).expect(401);
    });

    test('réserve le catalogue aux administrateurs', async () => {
      await request(app).get(URL).set({ Authorization: jetonPour('Agent') }).expect(403);
      await request(app).get(URL).set({ Authorization: jetonPour('Client') }).expect(403);
    });
  });
});
