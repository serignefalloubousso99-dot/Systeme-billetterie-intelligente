import { sequelize } from '../config/database.js';
import Formule, { TYPES_FORMULE } from './Formule.js';
import Abonnement, { STATUTS_ABONNEMENT, STATUTS_EN_COURS } from './Abonnement.js';
import Consommation from './Consommation.js';

// --- Associations -----------------------------------------------------------

// Une formule est souscrite par plusieurs abonnements.
// RESTRICT : on ne peut pas supprimer une formule encore référencée — c'est la
// contrepartie technique de la règle « on désactive, on ne supprime jamais » (§4.1).
Formule.hasMany(Abonnement, { foreignKey: { name: 'FormuleId', allowNull: false }, onDelete: 'RESTRICT' });
Abonnement.belongsTo(Formule, { foreignKey: { name: 'FormuleId', allowNull: false } });

// Un abonnement porte l'historique de ses voyages.
// CASCADE : supprimer un abonnement doit emporter son historique, qui n'a
// aucun sens isolément.
Abonnement.hasMany(Consommation, { foreignKey: { name: 'AbonnementId', allowNull: false }, onDelete: 'CASCADE' });
Consommation.belongsTo(Abonnement, { foreignKey: { name: 'AbonnementId', allowNull: false } });

// Les énumérations sont ré-exportées ici : les contrôleurs n'ont ainsi qu'un
// seul point d'entrée pour tout ce qui touche aux modèles.
export {
  sequelize,
  Formule,
  Abonnement,
  Consommation,
  TYPES_FORMULE,
  STATUTS_ABONNEMENT,
  STATUTS_EN_COURS,
};
