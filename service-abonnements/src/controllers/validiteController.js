import { Op } from 'sequelize';
import { Formule, Abonnement, STATUTS_EN_COURS } from '../models/index.js';

/**
 * Vérification du droit à voyager.
 * Contrat d'API : PLAN-SERVICE-ABONNEMENTS.md §4.4
 *
 * C'est le point d'entrée du futur Service Billetterie : à chaque scan de QR
 * Code, il demande ici si le porteur peut monter.
 */

// GET /api/abonnements/validite/:utilisateurId
export const verifierValidite = async (req, res) => {
  try {
    const { utilisateurId } = req.params;

    // Seuls les abonnements encore pilotables méritent d'être examinés :
    // inutile de charger l'historique des contrats résiliés ou expirés.
    const candidats = await Abonnement.findAll({
      where: { utilisateurId, statut: { [Op.in]: STATUTS_EN_COURS } },
      include: Formule,
    });

    const utilisables = [];
    for (const abonnement of candidats) {
      // Le statut réel est recalculé, et persisté si la situation a changé
      // depuis la dernière lecture (règle actée §4.2).
      await abonnement.rafraichirStatut();
      if (abonnement.statut === 'ACTIF') utilisables.push(abonnement);
    }

    if (utilisables.length === 0) {
      return res.status(200).json({ valide: false, abonnement: null });
    }

    // Un client peut détenir plusieurs titres utilisables : un abonnement en
    // cours et des tickets simples. On retient celui qui expire le plus tôt,
    // pour éviter qu'un titre soit perdu alors qu'un autre restait valable
    // plus longtemps.
    utilisables.sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
    const retenu = utilisables[0];

    // Réponse volontairement réduite aux trois champs du contrat : le Service
    // Billetterie n'a pas besoin de connaître le détail de l'abonnement.
    return res.status(200).json({
      valide: true,
      abonnement: {
        id: retenu.id,
        voyagesRestants: retenu.voyagesRestants,
        dateExpiration: retenu.dateExpiration,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la vérification de validité' });
  }
};
