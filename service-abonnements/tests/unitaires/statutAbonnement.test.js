/**
 * Tests unitaires — Statut effectif et solde d'un abonnement
 *
 * Fonctionnalité : règle actée §4.2 du plan — le statut EXPIRE ou EPUISE est
 * calculé à la lecture, sans tâche planifiée.
 *
 * C'est la règle métier la plus structurante du service : c'est elle qui
 * décide si un passager peut monter. Les objets sont construits en mémoire
 * (`build`), sans écriture : aucune base n'est nécessaire.
 */
import '../setupEnv.js';
import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Abonnement } from '../../src/models/index.js';

const dans = (jours) => {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().split('T')[0];
};

// Ecart en heures par rapport à maintenant, pour vérifier la précision à
// l'heure près (résiliation dès la date ET l'heure d'expiration atteintes).
const dansHeures = (heures) => new Date(Date.now() + heures * 60 * 60 * 1000);

const abonnement = (surcharges = {}) =>
  Abonnement.build({
    utilisateurId: '6a5b68fc8be4efac6e1a775e',
    FormuleId: 1,
    dateDebut: dans(0),
    dateExpiration: dans(30),
    voyagesAutorises: 20,
    voyagesConsommes: 0,
    statut: 'ACTIF',
    ...surcharges,
  });

describe('Solde de voyages', () => {
  test('déduit les voyages consommés du total autorisé', () => {
    assert.equal(abonnement({ voyagesAutorises: 20, voyagesConsommes: 5 }).voyagesRestants, 15);
  });

  test('ne descend jamais en dessous de zéro', () => {
    // Une incohérence de données ne doit pas produire un solde négatif,
    // qui serait affiché tel quel par le frontend.
    assert.equal(abonnement({ voyagesAutorises: 5, voyagesConsommes: 8 }).voyagesRestants, 0);
  });

  test('vaut null pour un illimité, qui n’a aucun compteur', () => {
    assert.equal(abonnement({ voyagesAutorises: null, voyagesConsommes: 99 }).voyagesRestants, null);
  });
});

describe('Statut effectif', () => {
  test('reste ACTIF tant que la date et le solde le permettent', () => {
    assert.equal(abonnement().statutEffectif(), 'ACTIF');
  });

  test('bascule en EXPIRE une fois la date dépassée', () => {
    const a = abonnement({ dateDebut: dans(-60), dateExpiration: dans(-1) });
    assert.equal(a.statutEffectif(), 'EXPIRE');
  });

  test('bascule en EPUISE quand le solde atteint zéro', () => {
    assert.equal(abonnement({ voyagesAutorises: 5, voyagesConsommes: 5 }).statutEffectif(), 'EPUISE');
  });

  test('reste ACTIF tant que l’heure précise d’expiration n’est pas atteinte', () => {
    // Comparaison à l'heure près (pas seulement au jour) : un abonnement qui
    // expire dans 2h, même aujourd'hui, doit encore servir.
    assert.equal(abonnement({ dateExpiration: dansHeures(2) }).statutEffectif(), 'ACTIF');
  });

  test('bascule en EXPIRE dès que l’heure précise d’expiration est dépassée', () => {
    // Même jour calendaire, mais l'heure exacte est passée : doit résilier.
    assert.equal(abonnement({ dateExpiration: dansHeures(-2) }).statutEffectif(), 'EXPIRE');
  });

  test('un illimité n’est jamais épuisé, quel que soit le nombre de voyages', () => {
    const a = abonnement({ voyagesAutorises: null, voyagesConsommes: 500 });
    assert.equal(a.statutEffectif(), 'ACTIF');
  });

  test('une suspension prime sur l’expiration', () => {
    // Les décisions de l'administrateur ne doivent jamais être écrasées par
    // un calcul automatique.
    const a = abonnement({ statut: 'SUSPENDU', dateExpiration: dans(-1) });
    assert.equal(a.statutEffectif(), 'SUSPENDU');
  });

  test('une résiliation prime sur tout', () => {
    const a = abonnement({ statut: 'RESILIE', voyagesConsommes: 0, dateExpiration: dans(30) });
    assert.equal(a.statutEffectif(), 'RESILIE');
  });

  test('l’expiration est prioritaire sur l’épuisement', () => {
    // Les deux conditions sont réunies : on annonce la cause la plus ancienne.
    const a = abonnement({ dateExpiration: dans(-1), voyagesAutorises: 5, voyagesConsommes: 5 });
    assert.equal(a.statutEffectif(), 'EXPIRE');
  });
});

describe('Utilisabilité', () => {
  test('un abonnement actif permet de voyager', () => {
    assert.equal(abonnement().estUtilisable(), true);
  });

  test('un abonnement expiré, épuisé ou suspendu ne le permet pas', () => {
    assert.equal(abonnement({ dateExpiration: dans(-1) }).estUtilisable(), false);
    assert.equal(abonnement({ voyagesAutorises: 1, voyagesConsommes: 1 }).estUtilisable(), false);
    assert.equal(abonnement({ statut: 'SUSPENDU' }).estUtilisable(), false);
  });
});
