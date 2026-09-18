import { Sequelize } from 'sequelize';
import logger from './logger.js';

// Base de données PostgreSQL du microservice Billetterie.
// Indépendante des bases MongoDB (Utilisateurs) et MySQL (Abonnements).
const nomBase =
  process.env.NODE_ENV === 'test'
    ? process.env.DB_NAME_TEST || 'billetterie_db_test'
    : process.env.DB_NAME || 'billetterie_db';

export const sequelize = new Sequelize(
  nomBase,
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    define: {
      freezeTableName: true,
      underscored: false,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info(`PostgreSQL connecté : ${nomBase} sur le port ${process.env.DB_PORT || 5432}`);

    if (process.env.NODE_ENV !== 'production') {
      // `alter: true` génère un ALTER TABLE invalide sur PostgreSQL pour la
      // colonne unique `codeUnique` (bug Sequelize/pg : "TYPE ... UNIQUE" au
      // lieu d'une contrainte séparée). On reste donc sur un sync simple ;
      // les changements de colonnes se font via une migration ciblée
      // (voir scripts/migrate-dateExpiration-billetterie.mjs).
      await sequelize.sync();
      logger.info('Schéma PostgreSQL synchronisé avec succès.');
    }
  } catch (error) {
    logger.error(`Erreur critique de connexion PostgreSQL : ${error.message}`);
    process.exit(1);
  }
};

export default sequelize;
