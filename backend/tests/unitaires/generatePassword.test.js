/**
 * Tests unitaires — Génération du mot de passe temporaire
 *
 * Cas couverts    : U1 à U3 (tableau de synthèse du livrable)
 * Fonctionnalité  : F4 — Activation de compte (criticité : élevée)
 *
 * Le cahier des charges impose « un mot de passe temporaire de 8 caractères
 * généré automatiquement ». Cette longueur est donc vérifiée en priorité :
 * c'est une exigence littérale, pas un choix d'implémentation.
 *
 * Aucune base de données ni requête réseau : fonction pure, exécution instantanée.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateTempPassword } from '../../src/utils/generatePassword.js';

describe('generateTempPassword', () => {
  test('génère un mot de passe de exactement 8 caractères', () => {
    // « un mot de passe temporaire de 8 caractères est généré automatiquement »
    for (let i = 0; i < 50; i++) {
      assert.equal(generateTempPassword().length, 8);
    }
  });

  test('ne contient que des caractères alphanumériques', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(generateTempPassword(), /^[a-z0-9]{8}$/);
    }
  });

  test('produit une valeur différente à chaque appel', () => {
    const generes = new Set();
    for (let i = 0; i < 100; i++) {
      generes.add(generateTempPassword());
    }
    // Tolérance : quelques collisions restent statistiquement possibles,
    // mais un générateur constant serait immédiatement détecté.
    assert.ok(generes.size > 90, `trop de collisions : ${generes.size}/100 valeurs distinctes`);
  });
});
