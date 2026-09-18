/**
 * Tests unitaires — Schéma et sérialisation du modèle User
 *
 * Cas couverts    : U8 à U14 (tableau de synthèse du livrable)
 * Fonctionnalités : F3 — Hachage / non-divulgation du mot de passe
 *                   F2 — Contrôle des rôles (énumération)
 *                   F4 — Valeurs par défaut à la création
 *
 * Deux règles de sécurité sont vérifiées ici :
 *   - le mot de passe ne doit JAMAIS apparaître dans une réponse JSON ;
 *   - un compte créé naît « Bloqué », donc inutilisable avant activation
 *     explicite par un administrateur.
 *
 * Ces tests portent sur la validation et la sérialisation du schéma Mongoose :
 * aucune connexion à MongoDB n'est nécessaire, les documents ne sont pas sauvegardés.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import User from '../../src/models/User.js';

// Ces tests portent sur la sérialisation et la validation du schéma :
// aucune connexion à MongoDB n'est nécessaire.
describe('Modèle User (sans base)', () => {
  const donnees = {
    nom: 'Diop',
    prenom: 'Awa',
    email: 'Awa.Diop@Test.COM',
    telephone: '+221771234567',
    password: 'MotDePasse1',
  };

  test('ne divulgue jamais le mot de passe en JSON', () => {
    const user = new User(donnees);
    const json = user.toJSON();
    assert.equal(json.password, undefined);
    assert.equal(json.__v, undefined);
  });

  test('expose un champ id exploitable par le frontend', () => {
    const user = new User(donnees);
    assert.ok(user.toJSON().id, 'le champ id doit être présent');
  });

  test('normalise l\'email en minuscules', () => {
    const user = new User(donnees);
    assert.equal(user.email, 'awa.diop@test.com');
  });

  test('applique les valeurs par défaut : rôle Client et statut Bloqué', () => {
    const user = new User(donnees);
    // Un compte créé ne doit jamais être utilisable avant activation.
    assert.equal(user.role, 'Client');
    assert.equal(user.status, 'Bloqué');
    assert.equal(user.mustChangePassword, false);
  });

  test('refuse un rôle ou un statut hors énumération', () => {
    const roleInvalide = new User({ ...donnees, role: 'Superviseur' }).validateSync();
    assert.ok(roleInvalide?.errors.role, 'un rôle inconnu doit être rejeté');

    const statutInvalide = new User({ ...donnees, status: 'Archivé' }).validateSync();
    assert.ok(statutInvalide?.errors.status, 'un statut inconnu doit être rejeté');
  });

  test('exige les champs obligatoires', () => {
    const erreurs = new User({}).validateSync().errors;
    for (const champ of ['nom', 'prenom', 'email', 'telephone', 'password']) {
      assert.ok(erreurs[champ], `${champ} doit être obligatoire`);
    }
  });

  test('rejette un email mal formé', () => {
    const erreur = new User({ ...donnees, email: 'pas-un-email' }).validateSync();
    assert.ok(erreur?.errors.email);
  });
});
