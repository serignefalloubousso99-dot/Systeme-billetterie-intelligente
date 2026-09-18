import nodemailer from 'nodemailer';
import { lienConfirmation, DUREE_VALIDITE_HEURES } from './confirmationToken.js';

// Crée le transporteur SMTP à partir des variables d'environnement.
// Retourne null si l'email n'est pas configuré (mode développement).
const createTransporter = () => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 587,
    secure: Number(EMAIL_PORT) === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
};

// Envoie un email générique. Ne fait pas planter le flux appelant en cas d'échec.
export const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[email] Non configuré — email à "${to}" non envoyé (sujet: ${subject}).`);
    return { sent: false, reason: 'email_non_configure' };
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error(`[email] Échec de l'envoi à "${to}": ${error.message}`);
    return { sent: false, reason: error.message };
  }
};

/**
 * Email d'activation de compte.
 *
 * Deux voies sont proposées, et c'est volontaire :
 *   - le mot de passe temporaire de 8 caractères, exigé par le cahier des charges ;
 *   - un lien de confirmation valable 48 h, qui permet de choisir directement
 *     son propre mot de passe sans passer par le temporaire.
 *
 * Le lien n'est ajouté que s'il est fourni : un renvoi de lien seul ou un
 * envoi sans jeton restent possibles.
 */
export const sendActivationEmail = async (user, tempPassword, token = null) => {
  const subject = 'Activation de votre compte - Système de Billetterie';

  const blocLien = token
    ? `
    <p>Ou choisissez directement votre propre mot de passe :</p>
    <p><a href="${lienConfirmation(token)}">Définir mon mot de passe</a></p>
    <p><em>Ce lien est valable ${DUREE_VALIDITE_HEURES} heures. Passé ce délai,
    demandez-en un nouveau à votre administrateur.</em></p>
  `
    : '';

  const html = `
    <p>Bonjour ${user.prenom},</p>
    <p>Votre compte a été activé. Utilisez les identifiants suivants pour vous connecter :</p>
    <ul>
      <li><strong>Email :</strong> ${user.email}</li>
      <li><strong>Mot de passe temporaire :</strong> ${tempPassword}</li>
    </ul>
    <p><em>Il vous sera demandé de modifier ce mot de passe lors de votre première connexion.</em></p>
    ${blocLien}
  `;
  return sendEmail({ to: user.email, subject, html });
};
