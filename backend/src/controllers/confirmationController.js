import User from '../models/User.js';
import { sendActivationEmail } from '../utils/sendEmail.js';
import { generateTempPassword } from '../utils/generatePassword.js';
import { genererConfirmationToken, dateExpirationToken } from '../utils/confirmationToken.js';

/**
 * Confirmation de compte par lien envoyé en e-mail.
 *
 * Ce mécanisme vient EN PLUS du mot de passe temporaire exigé par le cahier
 * des charges : il permet à l'utilisateur de choisir lui-même son mot de passe.
 * Les deux voies restent ouvertes tant que le lien n'a pas expiré.
 */

// Masque l'adresse pour la page de confirmation : elle rassure l'utilisateur
// sur le compte concerné sans divulguer l'adresse complète à qui détiendrait
// le lien par hasard.
const masquerEmail = (email) => {
  const [locale, domaine] = email.split('@');
  const visible = locale.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(locale.length - 1, 1))}@${domaine}`;
};

// Recherche un compte par jeton. Les champs sont `select: false` dans le
// schéma : il faut les demander explicitement.
const trouverParToken = (token) =>
  User.findOne({ confirmationToken: token }).select('+confirmationToken +confirmationTokenExpire');

// GET /api/auth/confirmation/:token — vérifie la validité avant d'afficher le formulaire
export const verifierLienConfirmation = async (req, res) => {
  try {
    const user = await trouverParToken(req.params.token);

    if (!user) {
      return res.status(404).json({ message: 'Lien de confirmation inconnu' });
    }
    // 410 Gone distingue un lien périmé d'un lien inexistant : le frontend
    // peut ainsi proposer d'en redemander un plutôt que d'afficher une erreur.
    if (user.confirmationTokenExpire < new Date()) {
      return res.status(410).json({ message: 'Lien expiré, demandez-en un nouveau' });
    }

    return res.status(200).json({
      valide: true,
      email: masquerEmail(user.email),
      expireLe: user.confirmationTokenExpire.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la vérification du lien' });
  }
};

// POST /api/auth/confirmation/:token — définit le mot de passe choisi
export const confirmerCompte = async (req, res) => {
  try {
    const { motDePasse } = req.body;

    if (!motDePasse || motDePasse.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const user = await trouverParToken(req.params.token);

    if (!user) {
      return res.status(404).json({ message: 'Lien de confirmation inconnu' });
    }
    if (user.confirmationTokenExpire < new Date()) {
      return res.status(410).json({ message: 'Lien expiré, demandez-en un nouveau' });
    }

    user.password = motDePasse; // haché par le hook pre('save')
    // Le mot de passe est choisi par l'utilisateur : plus rien à lui imposer.
    user.mustChangePassword = false;
    // Le jeton est consommé : un lien ne doit servir qu'une fois.
    user.confirmationToken = undefined;
    user.confirmationTokenExpire = undefined;
    await user.save();

    return res.status(200).json({ message: 'Mot de passe défini, vous pouvez vous connecter' });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la confirmation du compte' });
  }
};

// POST /api/admin/users/:id/confirmation/renvoyer — régénère et renvoie le lien
export const renvoyerLienConfirmation = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Renvoyer un lien n'a de sens que pour un compte activé dont le
    // propriétaire n'a pas encore choisi son mot de passe.
    if (user.status !== 'Actif' || !user.mustChangePassword) {
      return res.status(409).json({ message: "Ce compte n'attend pas de confirmation" });
    }

    // Le lien précédent est invalidé : un seul lien vivant à la fois.
    const token = genererConfirmationToken();
    const expiration = dateExpirationToken();
    user.confirmationToken = token;
    user.confirmationTokenExpire = expiration;

    // Le mot de passe temporaire est régénéré en même temps : l'ancien e-mail
    // devient entièrement caduc, y compris les identifiants qu'il contenait.
    const motDePasseTemporaire = generateTempPassword();
    user.password = motDePasseTemporaire;
    await user.save();

    const envoi = await sendActivationEmail(user, motDePasseTemporaire, token);

    return res.status(200).json({
      message: 'Lien renvoyé',
      expireLe: expiration.toISOString(),
      emailSent: envoi.sent,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du renvoi du lien' });
  }
};
