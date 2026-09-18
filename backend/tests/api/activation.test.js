/**
 * Tests d'API — Activation, blocage, suppression et actions groupées
 *
 * Cas couverts    : A20 à A28 (tableau de synthèse du livrable)
 * Fonctionnalités : F4 — Activation et mot de passe temporaire
 *                   F5 — Changement de mot de passe imposé
 *                   F7 — Actions groupées (effet de masse)
 *                   F8 — Suppression logique
 *
 * C'est le cœur métier du service. Trois règles y sont vérifiées :
 *   - activer régénère un mot de passe temporaire ET le stocke haché ;
 *   - bloquer ne régénère RIEN (sinon on invaliderait un accès sans raison) ;
 *   - supprimer est logique : l'enregistrement reste en base, seul le statut
 *     change, afin de préserver la traçabilité.
 *
 * Le dernier bloc couvre le cycle complet du verrouillage : un compte à mot de
 * passe temporaire ne peut rien administrer, mais garde le droit de changer son
 * mot de passe — puis retrouve l'accès.
 *
 * L'envoi d'e-mails est neutralisé par helpers.js : aucun message réel ne part.
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

describe('API — Activation, blocage et suppression', () => {
  let header;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ header } = await creerAdminEtToken(request, app));
  });

  test('activer un compte le passe à Actif et impose un changement de mot de passe', async () => {
    const user = await creerUtilisateur({ status: 'Bloqué' });
    const ancienHash = user.password;

    const res = await request(app)
      .patch(`/api/admin/users/${user.id}/status`)
      .set('Authorization', header)
      .send({ status: 'Actif' })
      .expect(200);

    assert.equal(res.body.status, 'Actif');

    const rafraichi = await User.findById(user.id);
    assert.equal(rafraichi.status, 'Actif');
    // Un mot de passe temporaire neuf doit remplacer l'ancien...
    assert.notEqual(rafraichi.password, ancienHash);
    // ...et il doit être stocké haché, jamais en clair.
    assert.ok(rafraichi.password.startsWith('$2'), 'le mot de passe doit être haché (bcrypt)');
    // ...et l'utilisateur doit être contraint de le remplacer.
    assert.equal(rafraichi.mustChangePassword, true);
  });

  test('bloquer un compte sans régénérer son mot de passe', async () => {
    const user = await creerUtilisateur({ status: 'Actif' });
    const ancienHash = user.password;

    await request(app)
      .patch(`/api/admin/users/${user.id}/status`)
      .set('Authorization', header)
      .send({ status: 'Bloqué' })
      .expect(200);

    const rafraichi = await User.findById(user.id);
    assert.equal(rafraichi.status, 'Bloqué');
    assert.equal(rafraichi.password, ancienHash);
  });

  test('la suppression est logique : la donnée est conservée', async () => {
    const user = await creerUtilisateur({ status: 'Actif' });

    await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set('Authorization', header)
      .expect(200);

    const rafraichi = await User.findById(user.id);
    assert.ok(rafraichi, "l'enregistrement ne doit pas disparaître de la base");
    assert.equal(rafraichi.status, 'Supprimé');
  });

  test('refuse un statut inconnu', async () => {
    const user = await creerUtilisateur();
    await request(app)
      .patch(`/api/admin/users/${user.id}/status`)
      .set('Authorization', header)
      .send({ status: 'Archivé' })
      .expect(400);
  });

  test('renvoie 404 pour un utilisateur inexistant', async () => {
    await request(app)
      .patch('/api/admin/users/64b5f0000000000000000000/status')
      .set('Authorization', header)
      .send({ status: 'Actif' })
      .expect(404);
  });

  describe('Actions groupées', () => {
    test('active plusieurs comptes en une seule requête', async () => {
      const a = await creerUtilisateur({ status: 'Bloqué', email: 'g1@test.com' });
      const b = await creerUtilisateur({ status: 'Bloqué', email: 'g2@test.com' });

      const res = await request(app)
        .patch('/api/admin/users/bulk-status')
        .set('Authorization', header)
        .send({ userIds: [a.id, b.id], action: 'Actif' })
        .expect(200);

      assert.equal(res.body.results.length, 2);
      for (const id of [a.id, b.id]) {
        const u = await User.findById(id);
        assert.equal(u.status, 'Actif');
        assert.equal(u.mustChangePassword, true);
      }
    });

    test('bloque puis supprime plusieurs comptes', async () => {
      const a = await creerUtilisateur({ status: 'Actif', email: 'g3@test.com' });

      await request(app).patch('/api/admin/users/bulk-status').set('Authorization', header)
        .send({ userIds: [a.id], action: 'Bloqué' }).expect(200);
      assert.equal((await User.findById(a.id)).status, 'Bloqué');

      await request(app).patch('/api/admin/users/bulk-status').set('Authorization', header)
        .send({ userIds: [a.id], action: 'Supprimé' }).expect(200);
      assert.equal((await User.findById(a.id)).status, 'Supprimé');
    });

    test('refuse une liste vide ou une action invalide', async () => {
      await request(app).patch('/api/admin/users/bulk-status').set('Authorization', header)
        .send({ userIds: [], action: 'Actif' }).expect(400);

      const u = await creerUtilisateur();
      await request(app).patch('/api/admin/users/bulk-status').set('Authorization', header)
        .send({ userIds: [u.id], action: 'Detruire' }).expect(400);
    });
  });

  describe('Changement de mot de passe imposé', () => {
    test('un compte à mot de passe temporaire ne peut rien administrer', async () => {
      const temporaire = await creerUtilisateur({
        role: 'Administrateur', status: 'Actif',
        password: 'Temporaire1', mustChangePassword: true,
      });
      const login = await request(app).post('/api/auth/login')
        .send({ email: temporaire.email, password: 'Temporaire1' }).expect(200);
      const jeton = `Bearer ${login.body.token}`;

      // Accès administration verrouillé...
      const bloque = await request(app).get('/api/admin/users').set('Authorization', jeton).expect(403);
      assert.equal(bloque.body.mustChangePassword, true);

      // ...mais le changement de mot de passe reste possible.
      await request(app).put('/api/users/profile/password').set('Authorization', jeton)
        .send({ oldPassword: 'Temporaire1', newPassword: 'DefinitifPass1' }).expect(200);

      // Une fois changé, l'accès est rétabli.
      await request(app).get('/api/admin/users').set('Authorization', jeton).expect(200);
    });
  });
});
