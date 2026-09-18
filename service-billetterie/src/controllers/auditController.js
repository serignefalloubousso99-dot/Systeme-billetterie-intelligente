import { Op } from 'sequelize';
import { AuditLog } from '../models/index.js';
import logger from '../config/logger.js';

/**
 * Contrôleur de consultation de la piste d'audit des actions sensibles.
 * Strictement réservé aux administrateurs.
 */

// GET /api/billetterie/audit
export const listerAudits = async (req, res) => {
  try {
    const { action, utilisateurId, ressourceType, date, recherche } = req.query;
    const where = {};

    if (action) where.action = action;
    if (utilisateurId) where.utilisateurId = utilisateurId;
    if (ressourceType) where.ressourceType = ressourceType;
    if (date) {
      where.createdAt = {
        [Op.gte]: new Date(`${date}T00:00:00.000Z`),
        [Op.lte]: new Date(`${date}T23:59:59.999Z`),
      };
    }
    if (recherche) {
      where[Op.or] = [
        { utilisateurId: { [Op.iLike]: `%${recherche}%` } },
        { ressourceId: { [Op.iLike]: `%${recherche}%` } },
      ];
    }

    const audits = await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    return res.status(200).json(audits);
  } catch (error) {
    logger.error(`Erreur lors de la récupération des logs d'audit : ${error.message}`);
    return res.status(500).json({ message: "Erreur lors de la consultation de la piste d'audit" });
  }
};

// GET /api/billetterie/audit/:id
export const getAuditById = async (req, res) => {
  try {
    const audit = await AuditLog.findByPk(req.params.id);
    if (!audit) {
      return res.status(404).json({ message: "Entrée d'audit introuvable" });
    }
    return res.status(200).json({ audit });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors de la consultation de l'audit" });
  }
};
