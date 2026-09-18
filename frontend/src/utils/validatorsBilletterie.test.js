import {
  validerFormatCodeTitre,
  estCodeScannable,
  formaterMotifRefus,
  badgeClasseStatutTitre,
} from './validatorsBilletterie';

describe('Validateurs et formateurs Service Billetterie (Frontend)', () => {
  describe('validerFormatCodeTitre', () => {
    it('accepte un code généré commençant par TKT- avec longueur suffisante', () => {
      expect(validerFormatCodeTitre('TKT-6fb9f5e3-213f-4b4c-9c55-fcd2ebd299a3')).toBe(true);
    });

    it('rejette un code arbitraire ne commençant pas par TKT-', () => {
      expect(validerFormatCodeTitre('PASS-12345678901234567890')).toBe(false);
      expect(validerFormatCodeTitre('')).toBe(false);
      expect(validerFormatCodeTitre(null)).toBe(false);
    });

    it('rejette un code trop court', () => {
      expect(validerFormatCodeTitre('TKT-123')).toBe(false);
    });
  });

  describe('estCodeScannable', () => {
    it('accepte une chaîne non vide', () => {
      expect(estCodeScannable('ABC')).toBe(true);
      expect(estCodeScannable('  XYZ  ')).toBe(true);
    });

    it('rejette les entrées vides ou invalides', () => {
      expect(estCodeScannable('')).toBe(false);
      expect(estCodeScannable('   ')).toBe(false);
      expect(estCodeScannable(null)).toBe(false);
      expect(estCodeScannable(undefined)).toBe(false);
    });
  });

  describe('formaterMotifRefus', () => {
    it('renvoie le libellé en français clair pour chaque motif standard', () => {
      expect(formaterMotifRefus('TICKET_DEJA_UTILISE')).toContain('déjà utilisé');
      expect(formaterMotifRefus('SOLDE_EPUISE')).toContain('épuisé');
      expect(formaterMotifRefus('QR_CODE_INCONNU')).toContain('inconnu');
    });

    it('renvoie le motif tel quel si inconnu du dictionnaire', () => {
      expect(formaterMotifRefus('MOTIF_CUSTOM')).toBe('MOTIF_CUSTOM');
    });

    it('renvoie null si aucun motif fourni', () => {
      expect(formaterMotifRefus(null)).toBeNull();
    });
  });

  describe('badgeClasseStatutTitre', () => {
    it('associe la classe CSS correspondant au statut', () => {
      expect(badgeClasseStatutTitre('ACTIF')).toBe('badge-status-actif');
      expect(badgeClasseStatutTitre('DESACTIVE')).toBe('badge-status-desactive');
      expect(badgeClasseStatutTitre('CONSOMME')).toBe('badge-status-consomme');
      expect(badgeClasseStatutTitre('EXPIRE')).toBe('badge-status-expire');
    });
  });
});
