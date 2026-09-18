import { Op } from 'sequelize';
import { TitreTransport } from '../models/index.js';
import { genererTokenUnique, genererQRCodeImage } from '../services/qrCodeService.js';
import { enregistrerAudit } from '../services/auditService.js';
import { verifierUtilisateurExiste, verifierAbonnementExiste } from '../services/interServices.js';
import { TYPES_TITRE, STATUTS_TITRE } from '../utils/constants.js';
import logger from '../config/logger.js';

const ipDeLaRequete = (req) => req.ip || req.connection.remoteAddress;

/**
 * Contrôleur de gestion des titres de transport numériques et des QR Codes.
 */

// POST /api/billetterie/titres
export const creerTitre = async (req, res) => {
  try {
    const { utilisateurId, typeTitre, abonnementId, dateExpiration } = req.body;

    if (!utilisateurId || typeof utilisateurId !== 'string') {
      return res.status(400).json({ message: 'Identifiant client (utilisateurId) obligatoire' });
    }

    if (!typeTitre || !TYPES_TITRE.includes(typeTitre)) {
      return res.status(400).json({
        message: `typeTitre invalide. Valeurs possibles : ${TYPES_TITRE.join(', ')}`,
      });
    }

    if (typeTitre !== 'TICKET_SIMPLE' && !abonnementId) {
      return res.status(400).json({
        message: "L'identifiant de l'abonnement (abonnementId) est obligatoire pour ce type de titre",
      });
    }

    // 0. Vérification de l'existence du client et, le cas échéant, de
    // l'abonnement auprès des autres microservices avant d'émettre un titre.
    // Un service temporairement indisponible ne bloque pas la génération
    // (dégradation gracieuse) ; une réponse explicite "introuvable" la bloque.
    // Désactivé en test : la suite du Service Billetterie tourne isolée, sans
    // les autres microservices, et utilise des identifiants factices.
    if (process.env.NODE_ENV !== 'test') {
      const verifClient = await verifierUtilisateurExiste(utilisateurId, req.token);
      if (!verifClient.succes && !verifClient.indisponible) {
        return res.status(404).json({ message: 'Client introuvable dans le Service Utilisateurs' });
      }

      if (typeTitre !== 'TICKET_SIMPLE') {
        const verifAbo = await verifierAbonnementExiste(abonnementId, req.token);
        if (!verifAbo.succes && !verifAbo.indisponible) {
          return res.status(404).json({ message: 'Abonnement introuvable dans le Service Abonnements' });
        }
      }
    }

    // 1. Génération du token cryptographique unique
    const codeUnique = genererTokenUnique();

    // 2. Rendu de l'image QR Code
    const qrCodeData = await genererQRCodeImage(codeUnique);

    // 3. Enregistrement en base PostgreSQL
    const titre = await TitreTransport.create({
      codeUnique,
      qrCodeData,
      utilisateurId,
      typeTitre,
      abonnementId: abonnementId || null,
      statut: 'ACTIF',
      dateCreation: new Date(),
      dateExpiration: dateExpiration || null,
    });

    await enregistrerAudit({
      utilisateurId: req.user.id,
      role: req.user.role,
      action: 'GENERATION_TITRE',
      ressourceType: 'TITRE',
      ressourceId: titre.id,
      details: { codeUnique, typeTitre, utilisateurId, abonnementId: abonnementId || null },
      ipAdresse: ipDeLaRequete(req),
    });

    logger.info(`Titre généré : ${titre.id} (${typeTitre}) pour le client ${utilisateurId}`);
    return res.status(201).json({ titre });
  } catch (error) {
    logger.error(`Erreur lors de la création du titre : ${error.message}`);
    return res.status(500).json({ message: 'Erreur lors de la génération du titre de transport' });
  }
};

// GET /api/billetterie/titres
export const listerTitres = async (req, res) => {
  try {
    const { statut, typeTitre, utilisateurId, recherche } = req.query;
    const where = {};

    if (statut && STATUTS_TITRE.includes(statut)) {
      where.statut = statut;
    }
    if (typeTitre && TYPES_TITRE.includes(typeTitre)) {
      where.typeTitre = typeTitre;
    }
    if (utilisateurId) {
      where.utilisateurId = utilisateurId;
    }
    if (recherche) {
      where[Op.or] = [
        { codeUnique: { [Op.iLike]: `%${recherche}%` } },
        { utilisateurId: { [Op.iLike]: `%${recherche}%` } },
      ];
    }

    const titres = await TitreTransport.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(titres);
  } catch (error) {
    logger.error(`Erreur lors de la récupération des titres : ${error.message}`);
    return res.status(500).json({ message: 'Erreur lors de la récupération des titres' });
  }
};

// GET /api/billetterie/titres/:id
export const getTitreById = async (req, res) => {
  try {
    const titre = await TitreTransport.findByPk(req.params.id);
    if (!titre) {
      return res.status(404).json({ message: 'Titre de transport introuvable' });
    }
    return res.status(200).json({ titre });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la consultation du titre' });
  }
};

// PATCH /api/billetterie/titres/:id/statut
export const changerStatutTitre = async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['ACTIF', 'DESACTIVE'].includes(statut)) {
      return res.status(400).json({
        message: "Seuls les statuts ACTIF et DESACTIVE peuvent être appliqués manuellement",
      });
    }

    const titre = await TitreTransport.findByPk(req.params.id);
    if (!titre) {
      return res.status(404).json({ message: 'Titre de transport introuvable' });
    }

    const ancienStatut = titre.statut;
    titre.statut = statut;
    await titre.save();

    await enregistrerAudit({
      utilisateurId: req.user.id,
      role: req.user.role,
      action: statut === 'DESACTIVE' ? 'DESACTIVATION_TITRE' : 'ACTIVATION_TITRE',
      ressourceType: 'TITRE',
      ressourceId: titre.id,
      details: { ancienStatut, nouveauStatut: statut },
      ipAdresse: ipDeLaRequete(req),
    });

    logger.info(`Statut titre #${titre.id} changé de ${ancienStatut} à ${statut} par ${req.user.id}`);
    return res.status(200).json({ titre });
  } catch (error) {
    logger.error(`Erreur lors du changement de statut du titre : ${error.message}`);
    return res.status(500).json({ message: 'Erreur lors de la modification du statut' });
  }
};

// GET /api/billetterie/titres/client/:utilisateurId
export const getTitresParClient = async (req, res) => {
  try {
    const { utilisateurId } = req.params;
    const titres = await TitreTransport.findAll({
      where: { utilisateurId },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json(titres);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des titres du client' });
  }
};
