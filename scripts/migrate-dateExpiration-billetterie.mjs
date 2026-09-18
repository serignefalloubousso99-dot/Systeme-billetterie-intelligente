/**
 * Migration ciblée, à exécuter une seule fois : convertit
 * titres_transport.dateExpiration de DATE à TIMESTAMP, sans passer par
 * sequelize.sync({ alter: true }) qui génère un ALTER TABLE invalide sur
 * PostgreSQL pour la colonne unique `codeUnique` (bug Sequelize/pg).
 *
 * Usage : node scripts/migrate-dateExpiration-billetterie.mjs
 */
import { sequelize } from '../service-billetterie/src/config/database.js';

const main = async () => {
  await sequelize.authenticate();
  await sequelize.query(
    'ALTER TABLE "titres_transport" ALTER COLUMN "dateExpiration" TYPE TIMESTAMP WITH TIME ZONE;'
  );
  console.log('Colonne dateExpiration migrée en TIMESTAMP avec succès.');
  await sequelize.close();
  process.exit(0);
};

main().catch((err) => {
  console.error('Échec de la migration :', err.message);
  process.exit(1);
});
