import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  genererTokenUnique,
  genererQRCodeImage,
  extraireCodeUnique,
} from '../../src/services/qrCodeService.js';

describe('Service QR Code (Unitaires)', () => {
  it('génère un token unique non prédictible commençant par TKT-', () => {
    const t1 = genererTokenUnique();
    const t2 = genererTokenUnique();

    assert.ok(t1.startsWith('TKT-'), 'Le token doit commencer par TKT-');
    assert.notEqual(t1, t2, 'Deux tokens successifs doivent être strictement distincts');
    assert.ok(t1.length >= 20, 'Le token doit avoir une longueur suffisante');
  });

  it('génère une image Data URL au format image/png base64', async () => {
    const token = genererTokenUnique();
    const dataUrl = await genererQRCodeImage(token);

    assert.ok(dataUrl.startsWith('data:image/png;base64,'), "Le format doit être un Data URL d'image PNG");
    assert.ok(dataUrl.length > 200, "L'image générée doit contenir des données base64 valides");
  });

  it('extrait et nettoie correctement le code QR scanné', () => {
    assert.equal(extraireCodeUnique('  TKT-12345  '), 'TKT-12345');
    assert.equal(extraireCodeUnique(''), null);
    assert.equal(extraireCodeUnique('   '), null);
    assert.equal(extraireCodeUnique(null), null);
    assert.equal(extraireCodeUnique(undefined), null);
  });
});
