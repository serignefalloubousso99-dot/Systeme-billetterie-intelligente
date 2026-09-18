import sequelize from '../config/database.js';
import TitreTransport from './TitreTransport.js';
import Validation from './Validation.js';
import AuditLog from './AuditLog.js';

// Relations
TitreTransport.hasMany(Validation, {
  foreignKey: 'titreId',
  as: 'validations',
  onDelete: 'SET NULL',
});

Validation.belongsTo(TitreTransport, {
  foreignKey: 'titreId',
  as: 'titre',
});

export { sequelize, TitreTransport, Validation, AuditLog };

export default {
  sequelize,
  TitreTransport,
  Validation,
  AuditLog,
};
