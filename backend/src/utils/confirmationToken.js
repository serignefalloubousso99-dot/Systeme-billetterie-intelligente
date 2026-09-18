import crypto from 'crypto';

/**
 * Jeton de confirmation envoyé par e-mail à l'activation d'un compte.
 *
 * Il permet à l'utilisateur de choisir lui-même son mot de passe plutôt que
 * d'employer celui généré automatiquement. Le mot de passe temporaire de
 * 8 caractères reste envoyé dans le même message : les deux voies coexistent.
 */

// 48 heures : le haut de la fourchette convenue (24-48 h), pour couvrir un
// week-end sans que l'utilisateur ait à redemander un lien.
export const DUREE_VALIDITE_HEURES = 48;

/**
 * 32 octets tirés du générateur cryptographique, soit 64 caractères
 * hexadécimaux. Math.random() serait prévisible et permettrait de deviner
 * le lien d'un autre compte.
 */
export const genererConfirmationToken = () => crypto.randomBytes(32).toString('hex');

export const dateExpirationToken = (depuis = new Date()) =>
  new Date(depuis.getTime() + DUREE_VALIDITE_HEURES * 60 * 60 * 1000);

// Adresse du formulaire de confirmation côté frontend
export const lienConfirmation = (token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${base}/confirmation/${token}`;
};
