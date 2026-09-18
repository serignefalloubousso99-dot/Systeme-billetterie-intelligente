// Règles de validation partagées par les formulaires du service Utilisateurs.
// Extraites des composants pour être testables unitairement (voir validators.test.js).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Numéro sénégalais : ce qui compte, ce sont les 9 chiffres. L'indicatif +221
// (ou 221) est accepté s'il est présent, mais n'est pas exigé.
const PHONE_REGEX = /^(?:\+?221)?\d{9}$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

export function isValidPhone(telephone) {
  return typeof telephone === 'string' && PHONE_REGEX.test(telephone.trim());
}

// Validation du formulaire utilisateur (CreateUserModal, EditUserModal, ProfileSettings).
// requireEmail: false uniquement pour ProfileSettings, où l'email n'est pas dans ce formulaire.
export function validateUserForm({ nom, prenom, email, telephone } = {}, { requireEmail = true } = {}) {
  if (!nom || !nom.trim()) {
    return 'Le nom est obligatoire.';
  }
  if (!prenom || !prenom.trim()) {
    return 'Le prénom est obligatoire.';
  }
  if (requireEmail) {
    if (!email) {
      return "L'adresse email est obligatoire.";
    }
    if (!isValidEmail(email)) {
      return "Cette adresse email n'est pas valide.";
    }
  }
  if (!telephone) {
    return 'Le numéro de téléphone est obligatoire.';
  }
  if (!isValidPhone(telephone)) {
    return 'Le numéro de téléphone doit comporter 9 chiffres (ex. 771234567), avec ou sans indicatif +221.';
  }
  return null;
}

// Règles du formulaire de connexion (Login)
export function validateLoginForm({ email, password } = {}) {
  if (!email) {
    return "Veuillez saisir votre adresse email ou votre identifiant.";
  }
  if (!password || password.length < 6) {
    return "Le mot de passe doit comporter au moins 6 caractères.";
  }
  return null;
}

// Le nouveau mot de passe doit respecter la longueur minimale et être confirmé (ProfileSettings)
export function validateNewPassword(newPassword, confirmPassword, minLength = 8) {
  if (!newPassword || newPassword.length < minLength) {
    return `Le mot de passe doit comporter au moins ${minLength} caractères.`;
  }
  if (newPassword !== confirmPassword) {
    return 'Les deux nouveaux mots de passe ne correspondent pas.';
  }
  return null;
}
