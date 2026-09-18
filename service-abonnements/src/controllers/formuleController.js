import { Formule, Abonnement, TYPES_FORMULE } from '../models/index.js';

/**
 * Gestion du catalogue des formules d'abonnement.
 * Contrat d'API : PLAN-SERVICE-ABONNEMENTS.md §4.1
 */

// Une erreur de validation Sequelize vient d'une saisie fautive : elle relève
// du 400, jamais du 500. Sans cette traduction, une simple faute de frappe
// remonterait comme une panne serveur.
const erreurValidation = (error) =>
  error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError';

const messageValidation = (error) =>
  error.errors?.map((e) => e.message).join(' · ') || error.message;

// Champs figés dès qu'au moins un client a souscrit la formule (règle actée §4.1)
const CHAMPS_FIGES = ['tarif', 'dureeValiditeJours', 'nombreVoyages'];

// Compare une valeur reçue à celle en base, en tolérant les différences de
// représentation. MariaDB renvoie les DECIMAL en chaîne ("18000.00") alors que
// le client envoie un nombre (18000) : sans comparaison numérique, renvoyer un
// tarif inchangé passerait pour une modification et déclencherait un 409 —
// ce qui casserait le simple renommage d'une formule depuis l'interface.
const memeValeur = (recue, enBase) => {
  if (recue === null || enBase === null) return recue === enBase;
  const a = Number(recue);
  const b = Number(enBase);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return a === b;
  return String(recue) === String(enBase);
};

// POST /api/abonnements/formules
export const creerFormule = async (req, res) => {
  try {
    const { nom, description, type, tarif, dureeValiditeJours, nombreVoyages } = req.body;

    if (!nom || !type || tarif === undefined || dureeValiditeJours === undefined) {
      return res.status(400).json({
        message: 'Champs obligatoires manquants (nom, type, tarif, dureeValiditeJours)',
      });
    }
    if (!TYPES_FORMULE.includes(type)) {
      return res.status(400).json({
        message: `Type invalide. Valeurs autorisées : ${TYPES_FORMULE.join(', ')}`,
      });
    }

    const formule = await Formule.create({
      nom,
      description: description ?? '',
      type,
      tarif,
      dureeValiditeJours,
      // Un illimité n'a pas de compteur, un ticket simple vaut toujours 1 voyage.
      nombreVoyages: type === 'ILLIMITE' ? null : type === 'TICKET_SIMPLE' ? 1 : nombreVoyages,
    });

    return res.status(201).json({ formule });
  } catch (error) {
    if (erreurValidation(error)) {
      return res.status(400).json({ message: messageValidation(error) });
    }
    return res.status(500).json({ message: 'Erreur lors de la création de la formule' });
  }
};

// GET /api/abonnements/formules?type=&actif=
export const listerFormules = async (req, res) => {
  try {
    const { type, actif } = req.query;
    const filtre = {};

    if (type) {
      if (!TYPES_FORMULE.includes(type)) {
        return res.status(400).json({
          message: `Type invalide. Valeurs autorisées : ${TYPES_FORMULE.join(', ')}`,
        });
      }
      filtre.type = type;
    }
    // Le paramètre arrive en chaîne depuis l'URL
    if (actif !== undefined) filtre.actif = actif === 'true';

    const formules = await Formule.findAll({ where: filtre, order: [['createdAt', 'DESC']] });
    // Le contrat impose un tableau simple, pas un objet enveloppe.
    return res.status(200).json(formules);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des formules' });
  }
};

// GET /api/abonnements/formules/:id
export const obtenirFormule = async (req, res) => {
  try {
    const formule = await Formule.findByPk(req.params.id);
    if (!formule) {
      return res.status(404).json({ message: 'Formule introuvable' });
    }
    return res.status(200).json({ formule });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PUT /api/abonnements/formules/:id
export const modifierFormule = async (req, res) => {
  try {
    const formule = await Formule.findByPk(req.params.id);
    if (!formule) {
      return res.status(404).json({ message: 'Formule introuvable' });
    }

    const { nom, description, tarif, dureeValiditeJours, nombreVoyages } = req.body;
    const modifications = { tarif, dureeValiditeJours, nombreVoyages };

    // Un champ n'est « touché » que s'il est fourni ET différent de l'existant :
    // renvoyer la formule inchangée ne doit pas déclencher un refus.
    const champsTouches = CHAMPS_FIGES.filter(
      (champ) => modifications[champ] !== undefined && !memeValeur(modifications[champ], formule[champ])
    );

    if (champsTouches.length > 0) {
      const nbSouscriptions = await Abonnement.count({ where: { FormuleId: formule.id } });
      if (nbSouscriptions > 0) {
        // Règle actée §4.1 : un client ayant payé 15 000 F ne doit pas voir son
        // abonnement rétroactivement revalorisé.
        return res.status(409).json({
          message:
            'Formule déjà souscrite : créez une nouvelle formule pour changer le tarif',
        });
      }
    }

    if (nom !== undefined) formule.nom = nom;
    if (description !== undefined) formule.description = description;
    if (tarif !== undefined) formule.tarif = tarif;
    if (dureeValiditeJours !== undefined) formule.dureeValiditeJours = dureeValiditeJours;
    if (nombreVoyages !== undefined && formule.type === 'LIMITE') formule.nombreVoyages = nombreVoyages;

    await formule.save();
    return res.status(200).json({ formule });
  } catch (error) {
    if (erreurValidation(error)) {
      return res.status(400).json({ message: messageValidation(error) });
    }
    return res.status(500).json({ message: 'Erreur lors de la modification de la formule' });
  }
};

// PATCH /api/abonnements/formules/:id/actif
export const changerActivationFormule = async (req, res) => {
  try {
    const { actif } = req.body;
    if (typeof actif !== 'boolean') {
      return res.status(400).json({ message: 'Le champ actif doit valoir true ou false' });
    }

    const formule = await Formule.findByPk(req.params.id);
    if (!formule) {
      return res.status(404).json({ message: 'Formule introuvable' });
    }

    // Désactiver retire la formule du catalogue sans toucher aux abonnements
    // déjà souscrits : c'est l'alternative à une suppression, interdite ici.
    formule.actif = actif;
    await formule.save();

    return res.status(200).json({ formule });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors du changement d'activation" });
  }
};
