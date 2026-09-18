import { AuditLog } from '../models/index.js';
import logger from '../config/logger.js';

/**
 * Journalise une action sensible dans la piste d'audit (append-only).
 * L'audit ne doit jamais faire échouer l'action métier qu'il journalise :
 * toute erreur d'écriture est seulement loguée techniquement.
 */
export const enregistrerAudit = async (
  { utilisateurId, role, action, ressourceType, ressourceId, resultat = 'SUCCES', details, ipAdresse },
  transaction
) => {
  try {
    await AuditLog.create(
      { utilisateurId, role, action, ressourceType, ressourceId, resultat, details, ipAdresse },
      transaction ? { transaction } : undefined
    );
  } catch (error) {
    logger.error(`Échec de journalisation de l'audit (${action} / ${ressourceId}) : ${error.message}`);
  }
};
