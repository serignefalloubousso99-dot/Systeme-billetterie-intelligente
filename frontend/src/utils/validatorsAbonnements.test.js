import { validateFormuleForm, validateSouscriptionForm } from './validatorsAbonnements';

describe('validateFormuleForm', () => {
  const base = { nom: 'Pass hebdo', type: 'LIMITE', tarif: 5000, dureeValiditeJours: 7, nombreVoyages: 10 };

  test('retourne null quand le formulaire est valide', () => {
    expect(validateFormuleForm(base)).toBeNull();
  });

  test('signale un nom manquant', () => {
    expect(validateFormuleForm({ ...base, nom: '' })).toMatch(/nom/i);
  });

  test('signale un type manquant ou invalide', () => {
    expect(validateFormuleForm({ ...base, type: 'AUTRE' })).toMatch(/type/i);
  });

  test('signale un tarif negatif', () => {
    expect(validateFormuleForm({ ...base, tarif: -100 })).toMatch(/tarif/i);
  });

  test('signale une duree de validite nulle', () => {
    expect(validateFormuleForm({ ...base, dureeValiditeJours: 0 })).toMatch(/dur[ée]e/i);
  });

  test('exige un nombre de voyages pour une formule limitee', () => {
    expect(validateFormuleForm({ ...base, nombreVoyages: 0 })).toMatch(/voyages/i);
  });

  test("n'exige pas de nombre de voyages pour un ticket simple", () => {
    expect(validateFormuleForm({ ...base, type: 'TICKET_SIMPLE', nombreVoyages: undefined })).toBeNull();
  });

  test("n'exige pas de nombre de voyages pour un illimite", () => {
    expect(validateFormuleForm({ ...base, type: 'ILLIMITE', nombreVoyages: undefined })).toBeNull();
  });
});

describe('validateSouscriptionForm', () => {
  const base = { utilisateurId: 'user-1', formuleId: 2, dateDebut: '2026-07-19' };

  test('retourne null quand le formulaire est valide', () => {
    expect(validateSouscriptionForm(base)).toBeNull();
  });

  test('signale un client manquant', () => {
    expect(validateSouscriptionForm({ ...base, utilisateurId: '' })).toMatch(/client/i);
  });

  test('signale une formule manquante', () => {
    expect(validateSouscriptionForm({ ...base, formuleId: '' })).toMatch(/formule/i);
  });

  test('signale une date de debut manquante', () => {
    expect(validateSouscriptionForm({ ...base, dateDebut: '' })).toMatch(/date/i);
  });
});
