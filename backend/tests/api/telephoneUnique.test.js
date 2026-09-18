/**
 * Tests d'API — Unicité du numéro de téléphone
 *
 * Fonctionnalité : un numéro identifie une personne, deux comptes ne peuvent
 * pas le partager.
 *
 * La contrainte s'applique aux quatre voies de création ou de modification :
 * création par l'administrateur, import CSV, modification d'une fiche et
 * modification de son propre profil. Un seul oubli suffirait à laisser
 * entrer un doublon.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import { connectTestDb, disconnectTestDb, clearTestDb, creerUtilisateur, creerAdminEtToken } from '../helpers.js';

const ENTETE_CSV = 'nom,prenom,email,telephone,role\n';

describe('API — Unicité du téléphone', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  test('refuse la création d’un compte avec un numéro déjà pris', async () => {
    await creerUtilisateur({ telephone: '+221771111111' });

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', header)
      .send({ nom: 'Fall', prenom: 'Awa', email: 'awa@test.com', telephone: '+221771111111' })
      .expect(409);

    assert.match(res.body.message, /téléphone/i);
  });

  test('accepte un numéro libre', async () => {
    await creerUtilisateur({ telephone: '+221771111111' });

    await request(app)
      .post('/api/admin/users')
      .set('Authorization', header)
      .send({ nom: 'Fall', prenom: 'Awa', email: 'awa@test.com', telephone: '+221772222222' })
      .expect(201);
  });

  test('refuse d’attribuer à une fiche le numéro d’un autre compte', async () => {
    const premier = await creerUtilisateur({ telephone: '+221771111111' });
    const second = await creerUtilisateur({ telephone: '+221772222222' });

    await request(app)
      .put(`/api/admin/users/${second.id}`)
      .set('Authorization', header)
      .send({ telephone: '+221771111111' })
      .expect(409);

    // Le compte visé ne doit pas avoir été modifié au passage.
    assert.equal((await User.findById(second.id)).telephone, '+221772222222');
    assert.equal((await User.findById(premier.id)).telephone, '+221771111111');
  });

  test('laisse renvoyer une fiche inchangée, son propre numéro compris', async () => {
    // Cas réel du formulaire d'édition, qui repost l'objet complet.
    const user = await creerUtilisateur({ telephone: '+221773333333' });

    await request(app)
      .put(`/api/admin/users/${user.id}`)
      .set('Authorization', header)
      .send({ nom: 'Nouveau nom', telephone: '+221773333333' })
      .expect(200);
  });

  test('applique la règle au profil du compte connecté', async () => {
    await creerUtilisateur({ telephone: '+221774444444' });
    const { motDePasse, admin } = await creerAdminEtToken(request, app);

    const connexion = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: motDePasse });
    const jeton = `Bearer ${connexion.body.token}`;

    await request(app)
      .put('/api/users/profile')
      .set('Authorization', jeton)
      .send({ telephone: '+221774444444' })
      .expect(409);

    // Conserver son propre numéro reste évidemment autorisé.
    await request(app)
      .put('/api/users/profile')
      .set('Authorization', jeton)
      .send({ nom: 'Modifié', telephone: admin.telephone })
      .expect(200);
  });

  describe('Import CSV', () => {
    const importer = (header, contenu) =>
      request(app)
        .post('/api/admin/users/import')
        .set('Authorization', header)
        .attach('file', Buffer.from(contenu), { filename: 'users.csv', contentType: 'text/csv' });

    test('écarte la ligne dont le numéro existe déjà en base', async () => {
      await creerUtilisateur({ telephone: '+221775555555' });

      const csv =
        ENTETE_CSV +
        'Sow,Ibrahima,ibrahima@test.com,+221775555555,Client\n' +
        'Ba,Fatou,fatou@test.com,+221776666666,Client\n';

      const res = await importer(header, csv).expect(200);

      assert.equal(res.body.summary.imported, 1);
      assert.equal(res.body.summary.skipped, 1);
      assert.match(res.body.summary.errors[0].raison, /téléphone/i);
    });

    test('écarte un doublon interne au fichier lui-même', async () => {
      // La deuxième ligne entre en collision avec la première, déjà insérée.
      const csv =
        ENTETE_CSV +
        'Un,Compte,un@test.com,+221777777777,Client\n' +
        'Deux,Compte,deux@test.com,+221777777777,Client\n';

      const res = await importer(header, csv).expect(200);

      assert.equal(res.body.summary.imported, 1);
      assert.equal(res.body.summary.skipped, 1);
      assert.match(res.body.summary.errors[0].raison, /téléphone/i);
    });
  });
});
