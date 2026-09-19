import { Sequelize } from 'sequelize';

// Connexion MySQL du microservice Abonnements.
// Ce service ne touche JAMAIS à la base MongoDB du Service Utilisateurs :
// il ne conserve que l'identifiant de l'utilisateur, jamais ses données
// personnelles (voir PLAN-SERVICE-ABONNEMENTS.md §1).
// Les valeurs saisies dans un tableau de bord (Render...) peuvent contenir un
// espace ou un saut de ligne invisible : on les nettoie avant usage.
const lire = (nom) => (process.env[nom] || '').trim();

const nomBase =
  process.env.NODE_ENV === 'test'
    ? lire('DB_NAME_TEST') || 'billetterie_abonnements_test'
    : lire('DB_NAME') || 'billetterie_abonnements';

export const sequelize = new Sequelize(
  nomBase,
  lire('DB_USER') || 'root',
  lire('DB_PASSWORD'),
  {
    host: lire('DB_HOST') || '127.0.0.1',
    port: Number(lire('DB_PORT')) || 3306,
    dialect: 'mysql',
    // Les requêtes SQL ne sont journalisées qu'en développement :
    // elles pollueraient la sortie des tests.
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      // Noms de tables tels que déclarés, sans pluralisation automatique
      freezeTableName: true,
      underscored: false,
    },
    // Les bases MySQL hébergées (Aiven...) imposent une connexion chiffrée.
    // DB_SSL=true l'active en vérifiant le certificat du serveur ; DB_SSL_CA
    // fournit le certificat de l'autorité si elle n'est pas publique.
    dialectOptions:
      process.env.DB_SSL === 'true'
        ? {
            ssl: {
              rejectUnauthorized: true,
              ...(lire('DB_SSL_CA') ? { ca: lire('DB_SSL_CA').replace(/\\n/g, '\n') } : {}),
            },
          }
        : {},
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
    } else if (process.env.DB_SYNC === 'true') {
      // Premier déploiement (base vide) : crée les tables sans modifier
      // celles qui existent déjà.
      await sequelize.sync();
    }
  } catch (error) {
    console.error(`Erreur de connexion MySQL : ${error.message}`);
    process.exit(1);
  }
};

export default sequelize;
