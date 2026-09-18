import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import { RESULTATS_VALIDATION } from '../utils/constants.js';

export class Validation extends Model {}

Validation.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      comment: 'Identifiant unique de validation formaté (ex: VAL-...)',
    },
    titreId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Référence au titre de transport validé (null si QR code inconnu)',
    },
    codeScanne: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Donnée brute lue par le scanner',
    },
    utilisateurId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Identifiant du voyageur concerné',
    },
    abonnementId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Identifiant de l'abonnement rattaché (le cas échéant)",
    },
    agentId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "Identifiant de l'agent ayant effectué le contrôle",
    },
    resultat: {
      type: DataTypes.ENUM(...RESULTATS_VALIDATION),
      allowNull: false,
    },
    motifRefus: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: 'Motif explicite en cas de refus du voyage',
    },
    dateValidation: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    heureValidation: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Validation',
    tableName: 'validations',
    timestamps: true,
  }
);

export default Validation;
