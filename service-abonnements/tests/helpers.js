// Doit rester en tête : bascule NODE_ENV avant que database.js ne le lise.
import './setupEnv.js';
// dotenv n'écrase jamais une variable déjà définie : NODE_ENV=test est préservé
// même si le .env contient NODE_ENV=development.
import 'dotenv/config';

import jwt from 'jsonwebtoken';
import { sequelize, Formule, Abonnement, Consommation } from '../src/models/index.js';

export { sequelize, Formule, Abonnement, Consommation };

/**
 * Utilitaires partagés par les suites de tests.
 *
 * Toutes les suites écrivent dans `billetterie_abonnements_test`, jamais dans
 * la base de développement. Les fichiers sont exécutés en série
 * (--test-concurrency=1) : contrairement à MongoDB où l'on peut créer une base
 * par processus à la volée, MySQL exige un CREATE DATABASE préalable. La
 * sérialisation évite qu'un fichier vide les tables pendant qu'un autre travaille.
 */

// Recrée un schéma vierge. `force` supprime puis recrée les tables.
export const preparerBase = async () => {
  await sequelize.sync({ force: true });
};

export const viderBase = async () => {
  await Consommation.destroy({ where: {} });
  await Abonnement.destroy({ where: {} });
  await Formule.destroy({ where: {} });
};

export const fermerBase = async () => {
  await sequelize.close();
};

/**
 * Jeton signé comme le ferait le Service Utilisateurs : même secret, même
 * charge utile `{ id, role }`. C'est ce qui garantit que les deux services
 * restent interopérables.
 */
export const jetonPour = (role = 'Administrateur', id = '6a5b68fc8be4efac6e1a775e') =>
  `Bearer ${jwt.sign({ id, role }, process.env.JWT_SECRET)}`;

export const enteteAdmin = () => ({ Authorization: jetonPour('Administrateur') });

// Date décalée de N jours, au format AAAA-MM-JJ attendu par le contrat
export const dans = (jours) => {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().split('T')[0];
};

// Identifiants MongoDB valides (24 caractères hexadécimaux), pour simuler
// des clients issus du Service Utilisateurs.
export const identifiantClient = (n) => `6a5b68fc8be4efac6e1a${String(7000 + n)}`;

// --- Fabriques de données ---------------------------------------------------

export const creerFormuleLimitee = (surcharges = {}) =>
  Formule.create({
    nom: 'Mensuel 20 voyages',
    type: 'LIMITE',
    tarif: 15000,
    dureeValiditeJours: 30,
    nombreVoyages: 20,
    ...surcharges,
  });

export const creerFormuleTicket = (surcharges = {}) =>
  Formule.create({
    nom: 'Ticket simple',
    type: 'TICKET_SIMPLE',
    tarif: 500,
    dureeValiditeJours: 1,
    nombreVoyages: 1,
    ...surcharges,
  });

export const creerFormuleIllimitee = (surcharges = {}) =>
  Formule.create({
    nom: 'Illimité mensuel',
    type: 'ILLIMITE',
    tarif: 50000,
    dureeValiditeJours: 30,
    nombreVoyages: null,
    ...surcharges,
  });

export const creerAbonnement = (formule, surcharges = {}) =>
  Abonnement.create({
    utilisateurId: identifiantClient(1),
    FormuleId: formule.id,
    dateDebut: dans(0),
    dateExpiration: dans(formule.dureeValiditeJours),
    voyagesAutorises: formule.nombreVoyages,
    ...surcharges,
  });
