/**
 * Tests d'API — Importation massive par fichier CSV
 *
 * Cas couverts    : A29 à A34 (tableau de synthèse du livrable)
 * Fonctionnalités : F6 — Importation CSV
 *                   F2 — Contrôle d'accès (import réservé aux administrateurs)
 *
 * L'import traite des lots entiers : une erreur s'y propage à des dizaines de
 * comptes, d'où sa criticité. Le comportement attendu n'est pas « tout ou
 * rien » mais un traitement ligne par ligne — une ligne fautive est écartée
 * avec son motif, sans interrompre les suivantes.
 *
 * Les quatre motifs de rejet sont couverts : doublon d'e-mail, format d'e-mail
 * invalide, champ obligatoire manquant, rôle hors énumération.
 *
 * Les fichiers sont envoyés en pièce jointe multipart, comme le ferait le
 * navigateur, afin de traverser réellement multer et le parseur CSV.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import {
  connectTestDb,
  disconnectTestDb,
  clearTestDb,
  creerUtilisateur,
  creerAdminEtToken,
} from '../helpers.js';

const ENTETE = 'nom,prenom,email,telephone,role\n';

// Envoie un contenu CSV en pièce jointe, comme le ferait le navigateur
const importer = (header, contenu) =>
  request(app)
    .post('/api/admin/users/import')
    .set('Authorization', header)
    .attach('file', Buffer.from(contenu), { filename: 'users.csv', contentType: 'text/csv' });

describe('API — Importation CSV', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  test('importe plusieurs comptes, tous bloqués par défaut', async () => {
    const csv = ENTETE +
      'Diop,Aminata,aminata@test.com,+221771111111,Agent\n' +
      'Fall,Awa,awa@test.com,+221772222222,Client\n';

    const res = await importer(header, csv).expect(200);

    assert.equal(res.body.count, 2);
    assert.equal(res.body.summary.imported, 2);
    assert.equal(res.body.summary.skipped, 0);

    const importes = await User.find({ email: { $in: ['aminata@test.com', 'awa@test.com'] } });
    assert.equal(importes.length, 2);
    // Aucun compte importé ne doit être utilisable avant activation.
    assert.ok(importes.every((u) => u.status === 'Bloqué'));
    // Le rôle indiqué dans le fichier doit être respecté.
    assert.equal(importes.find((u) => u.email === 'aminata@test.com').role, 'Agent');
  });

  test('ignore un doublon sans interrompre l\'import', async () => {
    await creerUtilisateur({ email: 'existant@test.com' });

    const csv = ENTETE +
      'Sow,Ibrahima,existant@test.com,+221773333333,Client\n' +
      'Ba,Fatou,nouvelle@test.com,+221774444444,Client\n';

    const res = await importer(header, csv).expect(200);

    assert.equal(res.body.summary.imported, 1, 'la ligne valide doit passer');
    assert.equal(res.body.summary.skipped, 1, 'le doublon doit être ignoré');
    assert.match(res.body.summary.errors[0].raison, /existant/i);
  });

  test('rejette ligne par ligne les données invalides', async () => {
    const csv = ENTETE +
      'Valide,Compte,valide@test.com,+221775555555,Client\n' +
      'Faye,Malick,email-sans-arobase,+221776666666,Client\n' +
      'Diallo,,sansprenom@test.com,+221777777777,Client\n' +
      'Kane,Rokhaya,role@test.com,+221778888888,Superviseur\n';

    const res = await importer(header, csv).expect(200);

    assert.equal(res.body.summary.imported, 1);
    assert.equal(res.body.summary.skipped, 3);

    const raisons = res.body.summary.errors.map((e) => e.raison).join(' | ');
    assert.match(raisons, /email invalide/i);
    assert.match(raisons, /obligatoires/i);
    assert.match(raisons, /rôle invalide/i);

    // Chaque erreur doit indiquer la ligne concernée, pour être exploitable.
    assert.ok(res.body.summary.errors.every((e) => typeof e.ligne === 'number'));
  });

  test('refuse un fichier qui n\'est pas un CSV', async () => {
    const res = await request(app)
      .post('/api/admin/users/import')
      .set('Authorization', header)
      .attach('file', Buffer.from('nom,prenom'), { filename: 'image.png', contentType: 'image/png' });

    assert.ok(res.status >= 400, 'un fichier non CSV doit être rejeté');
  });

  test('refuse une requête sans fichier', async () => {
    await request(app)
      .post('/api/admin/users/import')
      .set('Authorization', header)
      .expect(400);
  });

  test('exige une authentification administrateur', async () => {
    await request(app)
      .post('/api/admin/users/import')
      .attach('file', Buffer.from(ENTETE), { filename: 'users.csv', contentType: 'text/csv' })
      .expect(401);
  });
});
