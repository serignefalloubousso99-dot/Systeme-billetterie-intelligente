import { Op } from 'sequelize';
import {
  Formule,
  Abonnement,
  STATUTS_ABONNEMENT,
  STATUTS_EN_COURS,
  TYPES_FORMULE,
} from '../models/index.js';

/**
 * Souscriptions et cycle de vie des abonnements.
 * Contrat d'API : PLAN-SERVICE-ABONNEMENTS.md §4.2
 */

// Seuls ces statuts se pilotent à la main. EXPIRE et EPUISE sont calculés à la
// lecture (règle actée §4.2) : les imposer manuellement n'aurait aucun sens.
const STATUTS_PILOTABLES = ['ACTIF', 'SUSPENDU', 'RESILIE'];

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

const erreurValidation = (error) =>
  error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError';

const messageValidation = (error) =>
  error.errors?.map((e) => e.message).join(' · ') || error.message;

// Ajoute une durée en jours à un horodatage, en conservant l'heure exacte —
// une souscription prise à 14h32 pour 30 jours expire à 14h32, pas à minuit.
const ajouterJours = (date, jours) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + jours);
  return d;
};

// Combine la date 'AAAA-MM-JJ' reçue du formulaire avec l'heure actuelle :
// la résiliation doit pouvoir se déclencher à la date ET à l'heure précises
// (règle explicitement demandée), ce qu'un simple DATEONLY ne permet pas.
const dateDebutComplete = (dateISO) => {
  const heureActuelle = new Date().toISOString().split('T')[1];
  return new Date(`${dateISO}T${heureActuelle}`);
};

// Recharge l'abonnement avec sa formule : le contrat impose l'objet
// `formule: { id, nom, type }` imbriqué dans la réponse.
const avecFormule = (id) => Abonnement.findByPk(id, { include: Formule });

// POST /api/abonnements/souscriptions
export const souscrire = async (req, res) => {
  try {
    const { utilisateurId, formuleId, dateDebut } = req.body;

    if (!utilisateurId || !formuleId || !dateDebut) {
      return res.status(400).json({
        message: 'Champs obligatoires manquants (utilisateurId, formuleId, dateDebut)',
      });
    }
    if (!FORMAT_DATE.test(dateDebut)) {
      return res.status(400).json({ message: 'dateDebut doit être au format AAAA-MM-JJ' });
    }

    const formule = await Formule.findByPk(formuleId);
    if (!formule) {
      return res.status(404).json({ message: 'Formule introuvable' });
    }
    if (!formule.actif) {
      return res.status(409).json({ message: 'Cette formule n’est plus proposée' });
    }

    // Règle actée §4.2 : un client ne peut détenir qu'un seul abonnement en
    // cours. Les tickets simples y échappent — c'est le principe du carnet.
    if (formule.type !== 'TICKET_SIMPLE') {
      const enCours = await Abonnement.findOne({
        where: { utilisateurId, statut: { [Op.in]: STATUTS_EN_COURS } },
        include: { model: Formule, where: { type: { [Op.ne]: 'TICKET_SIMPLE' } } },
      });
      // Un abonnement expiré depuis la dernière lecture ne doit pas bloquer :
      // on recalcule son statut réel avant de refuser.
      if (enCours && STATUTS_EN_COURS.includes(enCours.statutEffectif())) {
        return res.status(409).json({ message: 'Ce client possède déjà un abonnement en cours' });
      }
      if (enCours) await enCours.rafraichirStatut();
    }

    const debut = dateDebutComplete(dateDebut);
    const abonnement = await Abonnement.create({
      utilisateurId,
      FormuleId: formule.id,
      dateDebut: debut,
      dateExpiration: ajouterJours(debut, formule.dureeValiditeJours),
      // Copiés depuis la formule : l'abonnement vendu garde ses conditions même
      // si le catalogue évolue ensuite.
      voyagesAutorises: formule.nombreVoyages,
      voyagesConsommes: 0,
      statut: 'ACTIF',
    });

    return res.status(201).json({ abonnement: await avecFormule(abonnement.id) });
  } catch (error) {
    if (erreurValidation(error)) {
      return res.status(400).json({ message: messageValidation(error) });
    }
    return res.status(500).json({ message: 'Erreur lors de la souscription' });
  }
};

// GET /api/abonnements/souscriptions?utilisateurId=&statut=&type=&recherche=&expireSous=
export const listerSouscriptions = async (req, res) => {
  try {
    const { utilisateurId, statut, type, recherche, expireSous } = req.query;

    if (statut && !STATUTS_ABONNEMENT.includes(statut)) {
      return res.status(400).json({
        message: `Statut invalide. Valeurs autorisées : ${STATUTS_ABONNEMENT.join(', ')}`,
      });
    }
    if (type && !TYPES_FORMULE.includes(type)) {
      return res.status(400).json({
        message: `Type invalide. Valeurs autorisées : ${TYPES_FORMULE.join(', ')}`,
      });
    }

    const where = {};
    if (utilisateurId) where.utilisateurId = utilisateurId;
    if (recherche) where.utilisateurId = { [Op.like]: `%${recherche}%` };

    const abonnements = await Abonnement.findAll({
      where,
      include: type ? { model: Formule, where: { type } } : Formule,
      order: [['createdAt', 'DESC']],
    });

    // Les statuts EXPIRE et EPUISE sont calculés, pas stockés en temps réel :
    // on les rafraîchit AVANT de filtrer, sinon un abonnement expiré depuis
    // hier ressortirait encore comme ACTIF dans les résultats.
    for (const abonnement of abonnements) {
      await abonnement.rafraichirStatut();
    }

    let resultat = statut ? abonnements.filter((a) => a.statut === statut) : abonnements;

    // Filtre « expire bientôt » (§8.1) : il ne sert pas à consulter mais à
    // agir — repérer les clients à relancer avant la coupure. On se limite
    // donc aux abonnements encore utilisables.
    if (expireSous !== undefined) {
      const jours = Number(expireSous);
      if (!Number.isInteger(jours) || jours < 0) {
        return res.status(400).json({ message: 'expireSous doit être un nombre entier de jours' });
      }
      const maintenant = new Date();
      const limite = ajouterJours(maintenant, jours);
      resultat = resultat.filter(
        (a) => a.statut === 'ACTIF' && new Date(a.dateExpiration) >= maintenant && new Date(a.dateExpiration) <= limite
      );
    }

    return res.status(200).json(resultat);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des abonnements' });
  }
};

// GET /api/abonnements/souscriptions/:id
export const obtenirSouscription = async (req, res) => {
  try {
    const abonnement = await avecFormule(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable' });
    }
    await abonnement.rafraichirStatut();
    return res.status(200).json({ abonnement });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PATCH /api/abonnements/souscriptions/:id/statut
export const changerStatut = async (req, res) => {
  try {
    const { statut } = req.body;

    if (!STATUTS_PILOTABLES.includes(statut)) {
      return res.status(400).json({
        message: `Statut invalide. Valeurs autorisées : ${STATUTS_PILOTABLES.join(', ')}`,
      });
    }

    const abonnement = await avecFormule(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable' });
    }

    // Une résiliation est définitive : réactiver reviendrait à ressusciter un
    // contrat rompu. Le client doit souscrire à nouveau.
    if (abonnement.statut === 'RESILIE' && statut !== 'RESILIE') {
      return res.status(409).json({
        message: 'Abonnement résilié : souscrivez un nouvel abonnement',
      });
    }

    abonnement.statut = statut;
    await abonnement.save();

    // Réactiver un abonnement dont la date est passée ou le solde épuisé ne
    // doit pas le rendre utilisable : on renvoie son statut réel.
    if (statut === 'ACTIF') await abonnement.rafraichirStatut();

    return res.status(200).json({ abonnement });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du changement de statut' });
  }
};

// POST /api/abonnements/souscriptions/:id/renouveler
export const renouveler = async (req, res) => {
  try {
    const { dateDebut } = req.body;

    if (!dateDebut || !FORMAT_DATE.test(dateDebut)) {
      return res.status(400).json({ message: 'dateDebut est obligatoire, au format AAAA-MM-JJ' });
    }

    const abonnement = await avecFormule(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable' });
    }
    if (abonnement.statut === 'RESILIE') {
      return res.status(409).json({
        message: 'Abonnement résilié : souscrivez un nouvel abonnement',
      });
    }
    if (abonnement.Formule.type === 'TICKET_SIMPLE') {
      return res.status(409).json({ message: 'Un ticket simple ne se renouvelle pas' });
    }

    // Le renouvellement repart d'une période neuve : nouvelles dates, compteur
    // remis à zéro. On conserve les conditions d'origine (voyagesAutorises),
    // conformément à la règle du tarif figé (§4.1).
    const debut = dateDebutComplete(dateDebut);
    abonnement.dateDebut = debut;
    abonnement.dateExpiration = ajouterJours(debut, abonnement.Formule.dureeValiditeJours);
    abonnement.voyagesConsommes = 0;
    abonnement.statut = 'ACTIF';
    await abonnement.save();

    await abonnement.rafraichirStatut();
    return res.status(200).json({ abonnement });
  } catch (error) {
    if (erreurValidation(error)) {
      return res.status(400).json({ message: messageValidation(error) });
    }
    return res.status(500).json({ message: 'Erreur lors du renouvellement' });
  }
};
