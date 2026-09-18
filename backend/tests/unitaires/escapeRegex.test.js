/**
 * Tests unitaires — Échappement des caractères spéciaux de la recherche
 *
 * Cas couverts    : U4 à U7 (tableau de synthèse du livrable)
 * Fonctionnalité  : F9 — Recherche et filtrage
 *
 * Ces tests couvrent une régression réelle, documentée en §5.1 du livrable :
 * la recherche construisait une expression régulière directement à partir de
 * la saisie. Tous les numéros du projet commençant par « + », un quantificateur
 * invalide en tête de motif, toute recherche par téléphone renvoyait une
 * erreur 500. Le premier test reproduit littéralement la panne.
 *
 * Aucune base de données ni requête réseau : fonction pure.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex } from '../../src/utils/escapeRegex.js';

describe('escapeRegex', () => {
  test('permet de construire une regex valide depuis un numéro de téléphone', () => {
    // Régression réelle : '+221...' brut levait
    // « Nothing to repeat » et provoquait une erreur 500 sur la recherche.
    assert.throws(() => new RegExp('+221771234567'), SyntaxError);
    assert.doesNotThrow(() => new RegExp(escapeRegex('+221771234567')));
  });

  test('trouve littéralement un numéro commençant par +', () => {
    const regex = new RegExp(escapeRegex('+221771234567'), 'i');
    assert.ok(regex.test('+221771234567'));
    assert.ok(regex.test('Tel : +221771234567'));
  });

  test('neutralise les métacaractères au lieu de les interpréter', () => {
    // '.' ne doit plus signifier « n'importe quel caractère »
    const regex = new RegExp(escapeRegex('a.c'), 'i');
    assert.ok(regex.test('a.c'));
    assert.equal(regex.test('abc'), false);
  });

  test('laisse un texte ordinaire inchangé', () => {
    assert.equal(escapeRegex('awa.diop'), 'awa\\.diop');
    assert.equal(escapeRegex('Diop'), 'Diop');
  });
});
