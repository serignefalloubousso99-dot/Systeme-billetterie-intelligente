import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Abonnement souscrit par un client.
 *
 * Ce modèle ne stocke que `utilisateurId` — l'identifiant MongoDB fourni par le
 * Service Utilisateurs. Aucune donnée personnelle n'est dupliquée ici
 * (PLAN-SERVICE-ABONNEMENTS.md §1). C'est le frontend qui croise les deux API
 * lorsqu'il a besoin d'afficher un nom.
 */
export const STATUTS_ABONNEMENT = ['ACTIF', 'SUSPENDU', 'EXPIRE', 'EPUISE', 'RESILIE'];

// Statuts considérés comme « en cours » : ils bloquent une nouvelle souscription
// LIMITE ou ILLIMITE pour le même client (règle actée, §4.2).
export const STATUTS_EN_COURS = ['ACTIF', 'SUSPENDU'];

class Abonnement extends Model {
  /**
   * Voyages restants. `null` pour un illimité : il n'y a aucun compteur à
   * décrémenter, le blocage se fait uniquement sur la date d'expiration.
   */
  get voyagesRestants() {
    if (this.voyagesAutorises === null || this.voyagesAutorises === undefined) return null;
    return Math.max(this.voyagesAutorises - this.voyagesConsommes, 0);
  }

  /**
   * Statut réel, calculé à la lecture — pas de tâche planifiée (règle actée, §4.2).
   *
   * Les statuts décidés par l'administrateur (SUSPENDU, RESILIE) priment :
   * ils ne doivent jamais être écrasés par un calcul automatique.
   *
   * La comparaison se fait à l'heure près (dateExpiration est un horodatage
   * complet, pas seulement un jour) : un abonnement souscrit à 14h32 pour
   * 30 jours expire à 14h32, pas à minuit.
   */
  statutEffectif(maintenant = new Date()) {
    if (this.statut === 'RESILIE' || this.statut === 'SUSPENDU') return this.statut;

    if (this.dateExpiration && maintenant > new Date(this.dateExpiration)) return 'EXPIRE';

    const restants = this.voyagesRestants;
    if (restants !== null && restants <= 0) return 'EPUISE';

    return 'ACTIF';
  }

  /** Recalcule le statut et le persiste s'il a changé. */
  async rafraichirStatut() {
    const effectif = this.statutEffectif();
    if (effectif !== this.statut) {
      this.statut = effectif;
      await this.save();
    }
    return this.statut;
  }

  /** L'abonnement permet-il de voyager maintenant ? */
  estUtilisable() {
    return this.statutEffectif() === 'ACTIF';
  }

  // Sérialisation conforme au contrat d'API (§4.2)
  toJSON() {
    const v = { ...this.get() };
    return {
      id: v.id,
      utilisateurId: v.utilisateurId,
      // La formule n'est présente que si la requête l'a jointe (include)
      formule: this.Formule
        ? { id: this.Formule.id, nom: this.Formule.nom, type: this.Formule.type }
        : undefined,
      dateDebut: v.dateDebut,
      dateExpiration: v.dateExpiration,
      voyagesAutorises: v.voyagesAutorises,
      voyagesConsommes: v.voyagesConsommes,
      voyagesRestants: this.voyagesRestants,
      statut: v.statut,
      creeLe: v.createdAt ? v.createdAt.toISOString().split('T')[0] : null,
      // Horodatage complet (date + heure), en plus de `creeLe` (date seule,
      // contrat existant §4.2 déjà testé) : nécessaire pour l'affichage
      // précis "créé à telle heure" côté audit/traçabilité.
      createdAt: v.createdAt,
    };
  }
}

Abonnement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Identifiant MongoDB du Service Utilisateurs (ObjectId sur 24 caractères)
    utilisateurId: {
      type: DataTypes.STRING(24),
      allowNull: false,
      validate: {
        is: { args: /^[a-f0-9]{24}$/i, msg: 'Identifiant utilisateur invalide' },
      },
    },
    // Horodatage complet (pas seulement un jour) : la résiliation doit
    // pouvoir se déclencher à la date ET à l'heure précises d'expiration.
    dateDebut: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    dateExpiration: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Copiés depuis la formule au moment de la souscription : si le catalogue
    // change plus tard, l'abonnement déjà vendu conserve ses conditions.
    voyagesAutorises: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    voyagesConsommes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    statut: {
      type: DataTypes.ENUM(...STATUTS_ABONNEMENT),
      allowNull: false,
      defaultValue: 'ACTIF',
    },
  },
  {
    sequelize,
    modelName: 'Abonnement',
    tableName: 'abonnements',
    indexes: [
      // La recherche par client est le cas d'usage le plus fréquent
      { fields: ['utilisateurId'] },
      { fields: ['statut'] },
    ],
    validate: {
      datesCoherentes() {
        if (this.dateExpiration <= this.dateDebut) {
          throw new Error("La date d'expiration doit être postérieure à la date de début");
        }
      },
    },
  }
);

export default Abonnement;
