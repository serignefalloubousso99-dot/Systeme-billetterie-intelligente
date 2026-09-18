import 'dotenv/config';
import app from './app.js';
import { connectDB, sequelize } from './config/database.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 5070;

const startServer = async () => {
  try {
    logger.info('Démarrage du Service Billetterie...');
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info(`Service Billetterie à l'écoute sur http://localhost:${PORT}`);
    });

    // Arrêt propre du service avec clôture de la connexion PostgreSQL
    const shutdown = async (signal) => {
      logger.info(`Signal ${signal} reçu : arrêt en cours du Service Billetterie...`);
      server.close(async () => {
        logger.info('Serveur HTTP fermé.');
        try {
          await sequelize.close();
          logger.info('Connexion PostgreSQL clôturée.');
        } catch (e) {
          logger.error(`Erreur lors de la fermeture PostgreSQL : ${e.message}`);
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error(`Échec critique au démarrage du serveur : ${error.message}`);
    process.exit(1);
  }
};

startServer();
