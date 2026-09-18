import { Sequelize } from 'sequelize';

// Connexion MySQL du microservice Abonnements.
// Ce service ne touche JAMAIS à la base MongoDB du Service Utilisateurs :
// il ne conserve que l'identifiant de l'utilisateur, jamais ses données
// personnelles (voir PLAN-SERVICE-ABONNEMENTS.md §1).
const nomBase =
  process.env.NODE_ENV === 'test'
    ? process.env.DB_NAME_TEST || 'billetterie_abonnements_test'
    : process.env.DB_NAME || 'billetterie_abonnements';

export const sequelize = new Sequelize(
  nomBase,
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    // Les requêtes SQL ne sont journalisées qu'en développement :
    // elles pollueraient la sortie des tests.
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      // Noms de tables tels que déclarés, sans pluralisation automatique
      freezeTableName: true,
      underscored: false,
    },
  }
);

// Ouvre la connexion et synchronise le schéma.
// `alter` en développement seulement : en production, on passerait par des migrations.
export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`MySQL connecté : ${nomBase}`);

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
    }
  } catch (error) {
    console.error(`Erreur de connexion MySQL : ${error.message}`);
    process.exit(1);
  }
};

export default sequelize;
