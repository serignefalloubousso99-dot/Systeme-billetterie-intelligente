import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Formule d'abonnement — le catalogue proposé aux clients.
 *
 * Une formule n'est jamais supprimée, seulement désactivée (`actif: false`) :
 * la supprimer casserait l'historique des abonnements déjà souscrits.
 * Voir PLAN-SERVICE-ABONNEMENTS.md §4.1.
 */
export const TYPES_FORMULE = ['TICKET_SIMPLE', 'LIMITE', 'ILLIMITE'];

class Formule extends Model {
  // Sérialisation conforme au contrat d'API (§4.1) :
  // champ `id`, dates en AAAA-MM-JJ, tarif en nombre.
  toJSON() {
    const v = { ...this.get() };
    return {
      id: v.id,
      nom: v.nom,
      description: v.description,
      type: v.type,
      // MySQL renvoie les DECIMAL sous forme de chaîne : le contrat impose un nombre.
      tarif: v.tarif === null ? null : Number(v.tarif),
      dureeValiditeJours: v.dureeValiditeJours,
      nombreVoyages: v.nombreVoyages,
      actif: v.actif,
      creeLe: v.createdAt ? v.createdAt.toISOString().split('T')[0] : null,
      // Horodatage complet, en plus de `creeLe` (contrat existant, date seule).
      createdAt: v.createdAt,
    };
  }
}

Formule.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nom: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: { notEmpty: { msg: 'Le nom est obligatoire' } },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: '',
    },
    type: {
      type: DataTypes.ENUM(...TYPES_FORMULE),
      allowNull: false,
    },
    tarif: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: { args: [0], msg: 'Le tarif ne peut pas être négatif' } },
    },
    dureeValiditeJours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: { args: [1], msg: 'La durée de validité doit être d’au moins 1 jour' } },
    },
    // Nombre de voyages autorisés : 1 pour un ticket simple,
    // N pour un abonnement limité, NULL pour un illimité (aucun compteur).
    nombreVoyages: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actif: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Formule',
    tableName: 'formules',
    validate: {
      // Cohérence entre le type et le nombre de voyages : une règle métier
      // qui n'a de sens qu'en regardant les deux champs ensemble.
      nombreVoyagesCoherent() {
        if (this.type === 'ILLIMITE' && this.nombreVoyages !== null) {
          throw new Error('Un abonnement illimité ne doit pas définir de nombre de voyages');
        }
        if (this.type === 'TICKET_SIMPLE' && this.nombreVoyages !== 1) {
          throw new Error('Un ticket simple doit autoriser exactement 1 voyage');
        }
        if (this.type === 'LIMITE' && (!this.nombreVoyages || this.nombreVoyages < 1)) {
          throw new Error('Un abonnement limité doit autoriser au moins 1 voyage');
        }
      },
    },
  }
);

export default Formule;
