import { Op } from 'sequelize';
import { TitreTransport, Validation } from '../models/index.js';
import logger from '../config/logger.js';

/**
 * Contrôleur des statistiques décisionnelles et indicateurs du Service Billetterie.
 */

// GET /api/billetterie/dashboard/stats
export const getStatistiques = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Statistiques sur les titres de transport
    const titres = await TitreTransport.findAll({
      attributes: ['statut', 'typeTitre'],
    });

    const titresParStatut = { ACTIF: 0, DESACTIVE: 0, CONSOMME: 0, EXPIRE: 0 };
    const titresParType = { TICKET_SIMPLE: 0, LIMITE: 0, ILLIMITE: 0 };

    for (const t of titres) {
      if (titresParStatut[t.statut] !== undefined) {
        titresParStatut[t.statut]++;
      }
      if (titresParType[t.typeTitre] !== undefined) {
        titresParType[t.typeTitre]++;
      }
    }

    // 2. Statistiques sur les validations
    const validations = await Validation.findAll({
      attributes: ['resultat', 'motifRefus', 'dateValidation', 'heureValidation', 'agentId'],
    });

    let totalValidations = validations.length;
    let validationsAujourdhui = 0;
    let autorises = 0;
    let refuses = 0;
    const refusParMotif = {};
    const validationsParHeure = {};
    // Initialiser les tranches horaires 00h à 23h
    for (let h = 0; h < 24; h++) {
      validationsParHeure[String(h).padStart(2, '0')] = 0;
    }

    for (const v of validations) {
      if (v.resultat === 'AUTORISE') {
        autorises++;
      } else {
        refuses++;
        if (v.motifRefus) {
          refusParMotif[v.motifRefus] = (refusParMotif[v.motifRefus] || 0) + 1;
        }
      }

      if (v.dateValidation === todayStr) {
        validationsAujourdhui++;
        if (v.heureValidation) {
          const heure = v.heureValidation.split(':')[0];
          if (validationsParHeure[heure] !== undefined) {
            validationsParHeure[heure]++;
          }
        }
      }
    }

    const tauxSucces = totalValidations > 0 ? Number(((autorises / totalValidations) * 100).toFixed(1)) : 100;

    return res.status(200).json({
      stats: {
        totalTitres: titres.length,
        titresParStatut,
        titresParType,
        totalValidations,
        validationsAujourdhui,
        autorises,
        refuses,
        tauxSucces,
        refusParMotif,
        validationsParHeure,
      },
    });
  } catch (error) {
    logger.error(`Erreur lors du calcul des statistiques : ${error.message}`);
    return res.status(500).json({ message: 'Erreur lors du calcul des statistiques' });
  }
};
