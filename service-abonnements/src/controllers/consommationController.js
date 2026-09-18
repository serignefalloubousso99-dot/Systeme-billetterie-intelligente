import { sequelize, Formule, Abonnement, Consommation } from '../models/index.js';

/**
 * Validation d'un voyage et historique des consommations.
 * Contrat d'API : PLAN-SERVICE-ABONNEMENTS.md §4.3
 *
 * C'est l'endpoint que consommera le futur Service Billetterie à chaque scan
 * de QR Code.
 */

// Motif de refus, exprimé pour l'agent qui a le passager devant lui.
const motifRefus = (abonnement) => {
  switch (abonnement.statutEffectif()) {
    case 'SUSPENDU':
      return 'Abonnement suspendu';
    case 'RESILIE':
      return 'Abonnement résilié';
    case 'EXPIRE':
      return 'Abonnement expiré';
    case 'EPUISE':
      return 'Solde de voyages épuisé';
    default:
      return null;
  }
};

// POST /api/abonnements/souscriptions/:id/consommer
export const consommerVoyage = async (req, res) => {
  const { validationId } = req.body;

  if (!validationId) {
    return res.status(400).json({ message: 'validationId est obligatoire' });
  }

  try {
    const resultat = await sequelize.transaction(async (t) => {
      // Verrou sur la ligne pendant toute la transaction : deux scans
      // simultanés du même QR Code ne doivent pas pouvoir décrémenter le
      // solde deux fois en passant tous les deux la vérification.
      const abonnement = await Abonnement.findByPk(req.params.id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!abonnement) {
        return { statut: 404, corps: { message: 'Abonnement introuvable' } };
      }

      const refus = motifRefus(abonnement);
      if (refus) {
        // Le statut réel est persisté au passage, mais DANS la transaction :
        // la ligne est verrouillée, un save() extérieur resterait bloqué.
        const effectif = abonnement.statutEffectif();
        if (effectif !== abonnement.statut) {
          abonnement.statut = effectif;
          await abonnement.save({ transaction: t });
        }
        return { statut: 409, corps: { message: refus } };
      }

      const consommation = await Consommation.create(
        { AbonnementId: abonnement.id, dateVoyage: new Date(), validationId },
        { transaction: t }
      );

      // Un illimité n'a aucun compteur à décrémenter, mais le voyage est tout
      // de même enregistré : le cahier des charges demande de conserver
      // l'historique réel à des fins statistiques.
      if (abonnement.voyagesAutorises !== null) {
        abonnement.voyagesConsommes += 1;
        // Le dernier voyage d'un solde le fait basculer en EPUISE.
        abonnement.statut = abonnement.statutEffectif();
        await abonnement.save({ transaction: t });
      }

      return { statut: 200, abonnementId: abonnement.id, consommation };
    });

    if (resultat.corps) {
      return res.status(resultat.statut).json(resultat.corps);
    }

    // Rechargé avec sa formule pour respecter la forme imposée par le contrat
    const abonnement = await Abonnement.findByPk(resultat.abonnementId, { include: Formule });
    return res.status(200).json({ abonnement, consommation: resultat.consommation });
  } catch (error) {
    // La contrainte d'unicité sur validationId est notre garde-fou contre le
    // double décompte d'un même scan.
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Cette validation a déjà été enregistrée' });
    }
    return res.status(500).json({ message: 'Erreur lors de la validation du voyage' });
  }
};

// GET /api/abonnements/souscriptions/:id/historique
export const historiqueVoyages = async (req, res) => {
  try {
    const abonnement = await Abonnement.findByPk(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable' });
    }

    const consommations = await Consommation.findAll({
      where: { AbonnementId: abonnement.id },
      order: [['dateVoyage', 'DESC'], ['id', 'DESC']],
    });

    // Le contrat impose un tableau simple.
    return res.status(200).json(consommations);
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors de la récupération de l'historique" });
  }
};
