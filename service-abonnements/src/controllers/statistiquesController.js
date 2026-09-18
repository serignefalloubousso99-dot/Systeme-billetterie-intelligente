import { Formule, Abonnement, STATUTS_ABONNEMENT, TYPES_FORMULE } from '../models/index.js';

/**
 * Tableau de bord des abonnements.
 * Contrat d'API : PLAN-SERVICE-ABONNEMENTS.md §4.5
 *
 * Les indicateurs retenus sont justifiés au §8.2 du plan : chacun doit
 * éclairer une décision, sinon il n'a pas sa place ici.
 */

// Nombre de jours au-delà duquel une expiration n'est plus « imminente ».
// Une semaine laisse le temps de relancer le client avant la coupure.
const SEUIL_EXPIRATION_PROCHE = 7;

export const joursAvant = (nombre, depuis = new Date()) => {
  const d = new Date(depuis);
  d.setDate(d.getDate() + nombre);
  return d;
};

// GET /api/abonnements/dashboard/stats
export const obtenirStatistiques = async (req, res) => {
  try {
    const abonnements = await Abonnement.findAll({ include: Formule });

    // Les statuts EXPIRE et EPUISE étant calculés à la lecture (règle §4.2),
    // il faut les rafraîchir avant d'agréger : sinon le tableau de bord
    // afficherait comme actifs des abonnements périmés depuis des jours.
    for (const abonnement of abonnements) {
      await abonnement.rafraichirStatut();
    }

    // Les compteurs partent de zéro pour chaque valeur possible : le frontend
    // reçoit toujours les mêmes clés, même quand aucun abonnement n'existe.
    const parStatut = Object.fromEntries(STATUTS_ABONNEMENT.map((s) => [s, 0]));
    const parType = Object.fromEntries(TYPES_FORMULE.map((t) => [t, 0]));

    let voyagesConsommesTotal = 0;
    let revenuTotal = 0;
    let expirentSous7Jours = 0;

    const limite = joursAvant(SEUIL_EXPIRATION_PROCHE);
    const aujourdHui = joursAvant(0);

    for (const abonnement of abonnements) {
      parStatut[abonnement.statut] += 1;
      parType[abonnement.Formule.type] += 1;
      voyagesConsommesTotal += abonnement.voyagesConsommes;

      // Chaque souscription correspond à une vente : le chiffre reste acquis
      // même si l'abonnement a depuis expiré ou été résilié.
      revenuTotal += Number(abonnement.Formule.tarif);

      // Seuls les abonnements encore utilisables méritent une relance.
      if (
        abonnement.statut === 'ACTIF' &&
        new Date(abonnement.dateExpiration) >= aujourdHui &&
        new Date(abonnement.dateExpiration) <= limite
      ) {
        expirentSous7Jours += 1;
      }
    }

    return res.status(200).json({
      stats: {
        total: abonnements.length,
        parStatut,
        parType,
        voyagesConsommesTotal,
        expirentSous7Jours,
        revenuTotal,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du calcul des statistiques' });
  }
};
