import express from 'express';
import cors from 'cors';
import titreRoutes from './routes/titreRoutes.js';
import validationRoutes from './routes/validationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import statistiquesRoutes from './routes/statistiquesRoutes.js';
import logger from './config/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(apiLimiter);

// Journalisation technique des appels importants
app.use((req, res, next) => {
  const debut = Date.now();
  res.on('finish', () => {
    const duree = Date.now() - debut;
    if (res.statusCode >= 400) {
      logger.warn(`Appel API : ${req.method} ${req.originalUrl} - Statut ${res.statusCode} (${duree}ms)`);
    } else {
      logger.info(`Appel API : ${req.method} ${req.originalUrl} - Statut ${res.statusCode} (${duree}ms)`);
    }
  });
  next();
});

// Route de diagnostic / santé
app.get('/api/billetterie/status', (_req, res) => {
  res.status(200).json({
    service: 'billetterie',
    status: 'success',
    message: 'Service Billetterie et QR Codes opérationnel',
    database: 'PostgreSQL',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Endpoints métier
app.use('/api/billetterie/titres', titreRoutes);
app.use('/api/billetterie/validations', validationRoutes);
app.use('/api/billetterie/audit', auditRoutes);
app.use('/api/billetterie/dashboard', statistiquesRoutes);

// Ressource introuvable
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
});

// Gestion centralisée des erreurs sans divulgation de détails techniques sensibles
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error(`Erreur interne serveur : ${err.message}`, { stack: err.stack });
    return res.status(500).json({ message: 'Une erreur interne est survenue sur le service billetterie' });
  }
  return res.status(status).json({ message: err.message || 'Erreur lors du traitement de la requête' });
});

export default app;
