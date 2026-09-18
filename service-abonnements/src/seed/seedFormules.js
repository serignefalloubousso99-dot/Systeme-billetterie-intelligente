// Doit rester le tout premier import : config/database.js lit process.env
// dès son chargement.
import 'dotenv/config';

import { sequelize, Formule, Abonnement } from '../models/index.js';

/**
 * Jeu de données de démonstration.
 *
 *   npm run seed:formules          → catalogue seul
 *   npm run seed:formules -- --demo → catalogue + abonnements d'exemple
 *
 * Le script est idempotent : relancé, il n'écrase rien et ne crée pas de
 * doublons. On peut donc l'exécuter sans crainte sur une base déjà remplie.
 */

// Catalogue inspiré d'une tarification de transport urbain réelle
const CATALOGUE = [
  {
    nom: 'Ticket simple',
    description: 'Un voyage, valable le jour de l’achat',
    type: 'TICKET_SIMPLE',
    tarif: 500,
    dureeValiditeJours: 1,
    nombreVoyages: 1,
  },
  {
    nom: 'Carnet 10 voyages',
    description: 'Dix voyages à utiliser sous deux mois',
    type: 'LIMITE',
    tarif: 4500,
    dureeValiditeJours: 60,
    nombreVoyages: 10,
  },
  {
    nom: 'Mensuel 20 voyages',
    description: 'Vingt voyages sur trente jours',
    type: 'LIMITE',
    tarif: 15000,
    dureeValiditeJours: 30,
    nombreVoyages: 20,
  },
  {
    nom: 'Mensuel 40 voyages',
    description: 'Quarante voyages sur trente jours, pour les trajets quotidiens',
    type: 'LIMITE',
    tarif: 28000,
    dureeValiditeJours: 30,
    nombreVoyages: 40,
  },
  {
    nom: 'Illimité mensuel',
    description: 'Voyages illimités pendant trente jours',
    type: 'ILLIMITE',
    tarif: 50000,
    dureeValiditeJours: 30,
    nombreVoyages: null,
  },
  {
    nom: 'Illimité annuel',
    description: 'Voyages illimités pendant un an',
    type: 'ILLIMITE',
    tarif: 500000,
    dureeValiditeJours: 365,
    nombreVoyages: null,
  },
];

const dans = (jours) => {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d.toISOString().split('T')[0];
};

// Identifiants au format MongoDB, comme en produirait le Service Utilisateurs
const client = (n) => `6a5b68fc8be4efac6e1a${String(9000 + n)}`;

/**
 * Abonnements couvrant chaque statut, pour que le tableau de bord et les
 * filtres aient de quoi s'afficher pendant une démonstration.
 */
const abonnementsDemo = (formules) => {
  const parNom = Object.fromEntries(formules.map((f) => [f.nom, f]));
  const mensuel20 = parNom['Mensuel 20 voyages'];
  const carnet = parNom['Carnet 10 voyages'];
  const illimite = parNom['Illimité mensuel'];
  const ticket = parNom['Ticket simple'];

  return [
    // Actif, largement entamé
    { formule: mensuel20, utilisateurId: client(1), dateDebut: dans(-10), dateExpiration: dans(20), voyagesConsommes: 8 },
    // Actif mais expire bientôt : c'est lui que remonte le filtre de relance
    { formule: mensuel20, utilisateurId: client(2), dateDebut: dans(-27), dateExpiration: dans(3), voyagesConsommes: 15 },
    // Solde épuisé
    { formule: carnet, utilisateurId: client(3), dateDebut: dans(-20), dateExpiration: dans(40), voyagesConsommes: 10 },
    // Période dépassée
    { formule: mensuel20, utilisateurId: client(4), dateDebut: dans(-60), dateExpiration: dans(-5), voyagesConsommes: 12 },
    // Illimité, jamais bloqué par son compteur
    { formule: illimite, utilisateurId: client(5), dateDebut: dans(-5), dateExpiration: dans(25), voyagesConsommes: 47 },
    // Suspendu par un administrateur
    { formule: mensuel20, utilisateurId: client(6), dateDebut: dans(-8), dateExpiration: dans(22), voyagesConsommes: 3, statut: 'SUSPENDU' },
    // Résilié
    { formule: carnet, utilisateurId: client(7), dateDebut: dans(-15), dateExpiration: dans(45), voyagesConsommes: 2, statut: 'RESILIE' },
    // Ticket simple non encore utilisé
    { formule: ticket, utilisateurId: client(8), dateDebut: dans(0), dateExpiration: dans(1), voyagesConsommes: 0 },
  ];
};

const seed = async () => {
  const avecDemo = process.argv.includes('--demo');

  await sequelize.authenticate();
  await sequelize.sync();

  const formules = [];
  let crees = 0;

  for (const donnees of CATALOGUE) {
    const [formule, cree] = await Formule.findOrCreate({
      where: { nom: donnees.nom },
      defaults: donnees,
    });
    formules.push(formule);
    if (cree) crees++;
  }

  console.log(`Catalogue : ${crees} formule(s) créée(s), ${CATALOGUE.length - crees} déjà présente(s)`);

  if (avecDemo) {
    let abonnementsCrees = 0;

    for (const modele of abonnementsDemo(formules)) {
      const { formule, ...reste } = modele;
      // Un même client ne doit pas se voir attribuer deux fois le même
      // abonnement si le script est relancé.
      const existe = await Abonnement.findOne({
        where: { utilisateurId: reste.utilisateurId, FormuleId: formule.id },
      });
      if (existe) continue;

      await Abonnement.create({
        ...reste,
        FormuleId: formule.id,
        voyagesAutorises: formule.nombreVoyages,
      });
      abonnementsCrees++;
    }

    console.log(`Démonstration : ${abonnementsCrees} abonnement(s) créé(s)`);
    console.log('  Statuts couverts : actif, expiration proche, épuisé, expiré, illimité, suspendu, résilié');
  } else {
    console.log('Astuce : ajoutez --demo pour créer aussi des abonnements d’exemple');
  }

  await sequelize.close();
};

seed().catch(async (error) => {
  console.error(`Échec du seed : ${error.message}`);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
