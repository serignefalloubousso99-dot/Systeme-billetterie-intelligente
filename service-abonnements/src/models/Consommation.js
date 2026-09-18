import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Consommation — un voyage effectivement validé.
 *
 * Une ligne est écrite à chaque validation, y compris pour les abonnements
 * illimités : le cahier des charges demande de conserver « l'historique du
 * nombre réel de voyages effectués » à des fins statistiques, sans jamais
 * bloquer le client sur ce compteur.
 */
class Consommation extends Model {
  // Sérialisation conforme au contrat d'API (§4.3)
  toJSON() {
    const v = { ...this.get() };
    return {
      id: v.id,
      dateVoyage: v.dateVoyage,
      validationId: v.validationId,
    };
  }
}

Consommation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dateVoyage: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // Référence de la validation fournie par le futur Service Billetterie.
    // Unique : elle garantit qu'un même scan de QR Code ne peut pas
    // décrémenter le solde deux fois.
    validationId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: 'Consommation',
    tableName: 'consommations',
    indexes: [{ fields: ['AbonnementId'] }],
  }
);

export default Consommation;
