import {
  isValidEmail,
  isValidPhone,
  validateUserForm,
  validateLoginForm,
  validateNewPassword,
} from './validators';

describe('isValidEmail', () => {
  test('accepte une adresse email correcte', () => {
    expect(isValidEmail('jean.dupont@entreprise.com')).toBe(true);
  });

  test('refuse une adresse sans @', () => {
    expect(isValidEmail('jean.dupont-entreprise.com')).toBe(false);
  });

  test('refuse une valeur vide', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPhone', () => {
  test('accepte 9 chiffres sans indicatif', () => {
    expect(isValidPhone('771234567')).toBe(true);
  });

  test('accepte le même numéro préfixé par +221', () => {
    expect(isValidPhone('+221771234567')).toBe(true);
  });

  test('accepte le même numéro préfixé par 221 sans le +', () => {
    expect(isValidPhone('221771234567')).toBe(true);
  });

  test('refuse un numéro trop court', () => {
    expect(isValidPhone('77123')).toBe(false);
  });

  test('refuse un numéro trop long', () => {
    expect(isValidPhone('7712345678')).toBe(false);
  });

  test('refuse des caractères non numériques', () => {
    expect(isValidPhone('+221 77 123 45 67')).toBe(false);
  });

  test('refuse une valeur vide', () => {
    expect(isValidPhone('')).toBe(false);
  });
});

describe('validateUserForm', () => {
  const champsValides = {
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean.dupont@entreprise.com',
    telephone: '+221771234567',
  };

  test('retourne null quand tous les champs sont valides', () => {
    expect(validateUserForm(champsValides)).toBeNull();
  });

  test('signale un champ requis manquant', () => {
    expect(validateUserForm({ ...champsValides, prenom: '' })).toMatch(/prénom/i);
  });

  test('signale une adresse email invalide', () => {
    expect(validateUserForm({ ...champsValides, email: 'jean.dupont-entreprise.com' })).toMatch(/email/i);
  });

  test('signale un numéro de téléphone invalide', () => {
    expect(validateUserForm({ ...champsValides, telephone: '123' })).toMatch(/téléphone/i);
  });

  test("n'exige pas l'email quand requireEmail vaut false (édition)", () => {
    const { email: _email, ...sansEmail } = champsValides;
    expect(validateUserForm(sansEmail, { requireEmail: false })).toBeNull();
  });

  test('retourne une erreur quand aucun champ n\'est fourni', () => {
    expect(validateUserForm()).toMatch(/nom/i);
  });
});

describe('validateLoginForm', () => {
  test("retourne une erreur si l'email est vide", () => {
    expect(validateLoginForm({ email: '', password: 'secret123' })).toMatch(/email/i);
  });

  test('retourne une erreur si le mot de passe fait moins de 6 caractères', () => {
    expect(validateLoginForm({ email: 'a@b.com', password: '123' })).toMatch(/6 caractères/i);
  });

  test('retourne null quand email et mot de passe sont valides', () => {
    expect(validateLoginForm({ email: 'a@b.com', password: 'secret123' })).toBeNull();
  });
});

describe('validateNewPassword', () => {
  test('retourne une erreur si le mot de passe est trop court', () => {
    expect(validateNewPassword('short1', 'short1')).toMatch(/8 caractères/i);
  });

  test('retourne une erreur si les deux mots de passe ne correspondent pas', () => {
    expect(validateNewPassword('longenough1', 'longenough2')).toMatch(/ne correspondent pas/i);
  });

  test('retourne null quand le mot de passe est valide et confirmé', () => {
    expect(validateNewPassword('longenough1', 'longenough1')).toBeNull();
  });
});
