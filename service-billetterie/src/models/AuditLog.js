import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import { ACTIONS_AUDIT, RESSOURCES_AUDIT } from '../utils/constants.js';

export class AuditLog extends Model {}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    utilisateurId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "Identifiant de l'auteur de l'action (Agent ou Administrateur)",
    },
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: "Rôle de l'auteur au moment de l'action",
    },
    action: {
      type: DataTypes.ENUM(...ACTIONS_AUDIT),
      allowNull: false,
      comment: "Type d'action sensible exécutée",
    },
    ressourceType: {
      type: DataTypes.ENUM(...RESSOURCES_AUDIT),
      allowNull: false,
      comment: 'Type de ressource impactée',
    },
    ressourceId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Identifiant de la ressource concernée',
    },
    resultat: {
      type: DataTypes.ENUM('SUCCES', 'ECHEC'),
      defaultValue: 'SUCCES',
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Détails contextuels complémentaires de l'action",
    },
    ipAdresse: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "Adresse IP de l'auteur",
    },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false, // Une piste d'audit est en écriture seule (append-only), jamais modifiée
  }
);

export default AuditLog;
