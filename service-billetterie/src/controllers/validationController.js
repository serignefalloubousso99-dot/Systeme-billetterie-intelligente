import { Op } from 'sequelize';
import { Validation, TitreTransport } from '../models/index.js';
import { validerScanQRCode } from '../services/validationService.js';
import logger from '../config/logger.js';

/**
 * Contrôleur de validation des QR codes et consultation de l'historique des validations.
 */

// POST /api/billetterie/validations/scan
export const scannerValidation = async (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Le code QR scanné (code) est obligatoire' });
  }

  try {
    const resultat = await validerScanQRCode({
      rawCode: code,
      agentId: req.user.id,
      agentRole: req.user.role,
      ipAdresse: req.ip || req.connection.remoteAddress,
      token: req.headers.authorization,
    });

    return res.status(200).json(resultat);
  } catch (error) {
    logger.error(`Erreur inattendue lors de la validation du scan : ${error.message}`);
    return res.status(500).json({ message: 'Erreur interne lors du traitement de la validation' });
  }
};

// GET /api/billetterie/validations
export const listerValidations = async (req, res) => {
  try {
    const { resultat, motifRefus, agentId, utilisateurId, date, recherche } = req.query;
    const where = {};

    if (resultat && ['AUTORISE', 'REFUSE'].includes(resultat)) {
      where.resultat = resultat;
    }
    if (motifRefus) {
      where.motifRefus = motifRefus;
    }
    if (agentId) {
      where.agentId = agentId;
    }
    if (utilisateurId) {
      where.utilisateurId = utilisateurId;
    }
    if (date) {
      where.dateValidation = date;
    }
    if (recherche) {
      where[Op.or] = [
        { id: { [Op.iLike]: `%${recherche}%` } },
        { codeScanne: { [Op.iLike]: `%${recherche}%` } },
        { utilisateurId: { [Op.iLike]: `%${recherche}%` } },
      ];
    }

    const validations = await Validation.findAll({
      where,
      include: [
        {
          model: TitreTransport,
          as: 'titre',
          attributes: ['id', 'typeTitre', 'statut', 'dateExpiration'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(validations);
  } catch (error) {
    logger.error(`Erreur lors de la récupération des validations : ${error.message}`);
    return res.status(500).json({ message: "Erreur lors de la récupération de l'historique des validations" });
  }
};

// GET /api/billetterie/validations/:id
export const getValidationById = async (req, res) => {
  try {
    const validation = await Validation.findByPk(req.params.id, {
      include: [{ model: TitreTransport, as: 'titre' }],
    });

    if (!validation) {
      return res.status(404).json({ message: 'Validation introuvable' });
    }

    return res.status(200).json({ validation });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération de la validation' });
  }
};
