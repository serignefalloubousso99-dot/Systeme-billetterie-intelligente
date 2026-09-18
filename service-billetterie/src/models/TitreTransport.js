import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import { TYPES_TITRE, STATUTS_TITRE } from '../utils/constants.js';

export class TitreTransport extends Model {
  /**
   * Vérifie si le titre est formellement utilisable (statut ACTIF et non expiré).
   */
  estValide() {
    if (this.statut !== 'ACTIF') return false;
    if (this.dateExpiration && new Date() > new Date(this.dateExpiration)) return false;
    return true;
  }
}

TitreTransport.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    codeUnique: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Token cryptographique unique encodé dans le QR Code',
    },
    qrCodeData: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Représentation Data URL (image/png base64) du QR code',
    },
    utilisateurId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'Identifiant du client dans le Service Utilisateurs',
    },
    typeTitre: {
      type: DataTypes.ENUM(...TYPES_TITRE),
      allowNull: false,
      comment: 'Type du titre de transport',
    },
    abonnementId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Identifiant de l'abonnement dans le Service Abonnements (le cas échéant)",
    },
    statut: {
      type: DataTypes.ENUM(...STATUTS_TITRE),
      defaultValue: 'ACTIF',
      allowNull: false,
    },
    dateCreation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    // Horodatage complet : l'expiration doit se déclencher à la date ET à
    // l'heure précises, pas seulement au changement de jour calendaire.
    dateExpiration: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    consommeLe: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date et heure de consommation définitive (ticket simple)',
    },
  },
  {
    sequelize,
    modelName: 'TitreTransport',
    tableName: 'titres_transport',
    timestamps: true,
  }
);

export default TitreTransport;
