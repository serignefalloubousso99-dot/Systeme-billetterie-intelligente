/**
 * Tests d'API — Tableau de bord et authentification
 *
 * Contrat : PLAN-SERVICE-ABONNEMENTS.md §4.5
 * Fonctionnalités : indicateurs de pilotage (§8.2) et contrôle d'accès (§4).
 *
 * Les jetons ne sont pas émis par ce service : ils viennent du Service
 * Utilisateurs. Les tests les signent avec le même secret, ce qui vérifie
 * l'interopérabilité entre les deux services.
 */
import '../helpers.js';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import {
  preparerBase,
  viderBase,
  fermerBase,
  enteteAdmin,
  jetonPour,
  dans,
  identifiantClient,
  creerFormuleLimitee,
  creerFormuleTicket,
  creerFormuleIllimitee,
  creerAbonnement,
} from '../helpers.js';

const STATS = '/api/abonnements/dashboard/stats';

// Hooks au niveau du fichier : la connexion est partagée par les deux suites.
before(preparerBase);
after(fermerBase);
beforeEach(viderBase);

describe('API — Tableau de bord', () => {

  test('renvoie toutes les clés même sans aucun abonnement', async () => {
    // Le frontend doit pouvoir afficher des zéros plutôt que des « undefined ».
    const res = await request(app).get(STATS).set(enteteAdmin()).expect(200);
    const { stats } = res.body;

    assert.equal(stats.total, 0);
    assert.equal(stats.parStatut.ACTIF, 0);
    assert.equal(stats.parStatut['EXPIRE'], 0);
    assert.equal(stats.parType.TICKET_SIMPLE, 0);
    assert.equal(stats.revenuTotal, 0);
  });

  test('ventile par statut et par type, et cumule les montants', async () => {
    const limitee = await creerFormuleLimitee();   // 15 000
    const ticket = await creerFormuleTicket();     //    500
    const illimitee = await creerFormuleIllimitee(); // 50 000

    await creerAbonnement(limitee, { utilisateurId: identifiantClient(1), voyagesConsommes: 5 });
    await creerAbonnement(limitee, { utilisateurId: identifiantClient(2), dateDebut: dans(-60), dateExpiration: dans(-1) });
    await creerAbonnement(limitee, { utilisateurId: identifiantClient(3), voyagesAutorises: 5, voyagesConsommes: 5 });
    await creerAbonnement(ticket, { utilisateurId: identifiantClient(4), statut: 'SUSPENDU' });
    await creerAbonnement(illimitee, { utilisateurId: identifiantClient(5), voyagesAutorises: null, voyagesConsommes: 40 });

    const res = await request(app).get(STATS).set(enteteAdmin()).expect(200);
    const { stats } = res.body;

    assert.equal(stats.total, 5);
    assert.equal(stats.parStatut.ACTIF, 2);
    // Statuts recalculés à la lecture : sans cela ces deux-là seraient comptés ACTIF.
    assert.equal(stats.parStatut['EXPIRE'], 1);
    assert.equal(stats.parStatut['EPUISE'], 1);
    assert.equal(stats.parStatut.SUSPENDU, 1);

    assert.equal(stats.parType.LIMITE, 3);
    assert.equal(stats.parType.TICKET_SIMPLE, 1);
    assert.equal(stats.parType.ILLIMITE, 1);

    assert.equal(stats.voyagesConsommesTotal, 50);
    assert.equal(stats.revenuTotal, 15000 * 3 + 500 + 50000);
  });

  test('compte les abonnements à relancer, et eux seuls', async () => {
    const formule = await creerFormuleLimitee();
    await creerAbonnement(formule, { utilisateurId: identifiantClient(1), dateExpiration: dans(3) });
    await creerAbonnement(formule, { utilisateurId: identifiantClient(2), dateExpiration: dans(25) });
    // Suspendu : rien à relancer tant qu'il n'est pas réactivé.
    await creerAbonnement(formule, { utilisateurId: identifiantClient(3), dateExpiration: dans(2), statut: 'SUSPENDU' });

    const res = await request(app).get(STATS).set(enteteAdmin()).expect(200);
    assert.equal(res.body.stats.expirentSous7Jours, 1);
  });

  test('réserve le pilotage aux administrateurs', async () => {
    await request(app).get(STATS).set({ Authorization: jetonPour('Agent') }).expect(403);
    await request(app).get(STATS).set({ Authorization: jetonPour('Client') }).expect(403);
    await request(app).get(STATS).expect(401);
  });
});

describe('API — Authentification', () => {
  const UNE_ROUTE = '/api/abonnements/formules';

  test('accepte un jeton émis par le Service Utilisateurs', async () => {
    // Même secret, même charge utile : c'est ce qui rend les deux services
    // interopérables sans qu'aucun appel ne les relie.
    await request(app).get(UNE_ROUTE).set({ Authorization: jetonPour('Administrateur') }).expect(200);
  });

  test('rejette un jeton absent, malformé ou falsifié', async () => {
    await request(app).get(UNE_ROUTE).expect(401);
    await request(app).get(UNE_ROUTE).set({ Authorization: 'Bearer nimportequoi' }).expect(401);
    await request(app).get(UNE_ROUTE).set({ Authorization: jetonPour('Administrateur').replace('Bearer ', '') }).expect(401);

    const faux = jwt.sign({ id: 'x', role: 'Administrateur' }, 'mauvais-secret');
    await request(app).get(UNE_ROUTE).set({ Authorization: `Bearer ${faux}` }).expect(401);
  });

  test('rejette un jeton expiré avec un message explicite', async () => {
    const expire = jwt.sign({ id: 'x', role: 'Administrateur' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app).get(UNE_ROUTE).set({ Authorization: `Bearer ${expire}` }).expect(401);
    assert.match(res.body.message, /expir/i);
  });

  test('renvoie 404 sur une route inconnue', async () => {
    await request(app).get('/api/abonnements/inexistant').set(enteteAdmin()).expect(404);
  });

  test('expose une route de vie sans authentification', async () => {
    const res = await request(app).get('/api/abonnements/status').expect(200);
    assert.equal(res.body.service, 'abonnements');
  });
});
