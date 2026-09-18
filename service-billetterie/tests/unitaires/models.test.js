import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TitreTransport } from '../../src/models/TitreTransport.js';

describe('Modèle TitreTransport — Méthode estValide()', () => {
  it('est valide si statut ACTIF et sans date d’expiration', () => {
    const titre = TitreTransport.build({ statut: 'ACTIF', dateExpiration: null });
    assert.equal(titre.estValide(), true);
  });

  it('est valide si statut ACTIF et date d’expiration future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const titre = TitreTransport.build({
      statut: 'ACTIF',
      dateExpiration: future.toISOString().split('T')[0],
    });
    assert.equal(titre.estValide(), true);
  });

  it('est invalide si statut DESACTIVE, CONSOMME ou EXPIRE', () => {
    assert.equal(TitreTransport.build({ statut: 'DESACTIVE' }).estValide(), false);
    assert.equal(TitreTransport.build({ statut: 'CONSOMME' }).estValide(), false);
    assert.equal(TitreTransport.build({ statut: 'EXPIRE' }).estValide(), false);
  });

  it('est invalide si la date d’expiration est dépassée', () => {
    const titre = TitreTransport.build({
      statut: 'ACTIF',
      dateExpiration: '2020-01-01',
    });
    assert.equal(titre.estValide(), false);
  });
});
