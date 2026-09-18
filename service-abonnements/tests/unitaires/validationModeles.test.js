/**
 * Tests unitaires — Validation des schémas Formule et Abonnement
 *
 * Fonctionnalité : cohérence des données à l'entrée du service.
 *
 * Ces règles sont la dernière barrière avant l'écriture en base : elles
 * s'appliquent quel que soit le chemin emprunté (API, seed, script). On les
 * vérifie sans connexion, via `validateSync`.
 */
import '../setupEnv.js';
import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Formule, Abonnement } from '../../src/models/index.js';

const dans = (jours) => {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().split('T')[0];
};

// Sequelize ne valide qu'à la sauvegarde : on déclenche la validation à la
// main et on capture l'erreur éventuelle.
const erreurDe = async (instance) => {
  try {
    await instance.validate();
    return null;
  } catch (e) {
    return e.errors?.map((x) => x.message).join(' · ') || e.message;
  }
};

const formule = (surcharges = {}) =>
  Formule.build({
    nom: 'Mensuel 20',
    type: 'LIMITE',
    tarif: 15000,
    dureeValiditeJours: 30,
    nombreVoyages: 20,
    ...surcharges,
  });

describe('Cohérence entre type et nombre de voyages', () => {
  test('accepte un abonnement limité correctement renseigné', async () => {
    assert.equal(await erreurDe(formule()), null);
  });

  test('refuse un illimité qui définirait un compteur', async () => {
    // Un compteur sur un illimité n'aurait aucun sens : rien ne le décrémente.
    const e = await erreurDe(formule({ type: 'ILLIMITE', nombreVoyages: 10 }));
    assert.match(e, /illimité/i);
  });

  test('refuse un ticket simple à plus d’un voyage', async () => {
    const e = await erreurDe(formule({ type: 'TICKET_SIMPLE', nombreVoyages: 3 }));
    assert.match(e, /ticket simple/i);
  });

  test('refuse un abonnement limité sans nombre de voyages', async () => {
    const e = await erreurDe(formule({ type: 'LIMITE', nombreVoyages: null }));
    assert.match(e, /limité/i);
  });
});

describe('Champs d’une formule', () => {
  test('refuse un tarif négatif', async () => {
    assert.ok(await erreurDe(formule({ tarif: -1 })));
  });

  test('refuse une durée de validité nulle', async () => {
    assert.ok(await erreurDe(formule({ dureeValiditeJours: 0 })));
  });

  test('refuse un nom vide', async () => {
    assert.ok(await erreurDe(formule({ nom: '' })));
  });
});

describe('Champs d’un abonnement', () => {
  const abonnement = (surcharges = {}) =>
    Abonnement.build({
      utilisateurId: '6a5b68fc8be4efac6e1a775e',
      FormuleId: 1,
      dateDebut: dans(0),
      dateExpiration: dans(30),
      voyagesAutorises: 20,
      ...surcharges,
    });

  test('accepte un identifiant client au format MongoDB', async () => {
    assert.equal(await erreurDe(abonnement()), null);
  });

  test('refuse un identifiant client mal formé', async () => {
    // Le lien avec le Service Utilisateurs ne tient qu'à cet identifiant :
    // une valeur fantaisiste rendrait l'abonnement orphelin.
    assert.ok(await erreurDe(abonnement({ utilisateurId: 'client-42' })));
  });

  test('refuse une expiration antérieure à la date de début', async () => {
    assert.ok(await erreurDe(abonnement({ dateDebut: dans(30), dateExpiration: dans(0) })));
  });

  test('refuse un nombre de voyages consommés négatif', async () => {
    assert.ok(await erreurDe(abonnement({ voyagesConsommes: -1 })));
  });
});
