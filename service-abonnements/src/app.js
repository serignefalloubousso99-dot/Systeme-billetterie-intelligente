import express from 'express';
import cors from 'cors';
import formuleRoutes from './routes/formuleRoutes.js';
import souscriptionRoutes from './routes/souscriptionRoutes.js';
import validiteRoutes from './routes/validiteRoutes.js';
import statistiquesRoutes from './routes/statistiquesRoutes.js';

// Application Express du Service Abonnements.
// Volontairement séparée de server.js : aucune écoute réseau, aucune connexion
// base au moment de l'import. Les tests peuvent donc l'utiliser directement
// via supertest, sans ouvrir de port.
const app = express();

app.use(cors());
app.use(express.json());

// Route de vie du service, pratique pour vérifier qu'il répond
app.get('/api/abonnements/status', (_req, res) => {
  res.json({
    service: 'abonnements',
    status: 'success',
    message: 'Service Abonnements opérationnel',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Catalogue des formules (§4.1)
app.use('/api/abonnements/formules', formuleRoutes);

// Souscriptions et cycle de vie (§4.2)
app.use('/api/abonnements/souscriptions', souscriptionRoutes);

// Verification du droit a voyager (§4.4), consommee par le Service Billetterie
app.use('/api/abonnements/validite', validiteRoutes);

// Tableau de bord (§4.5)
app.use('/api/abonnements/dashboard', statistiquesRoutes);

// Ressource inconnue
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
});

// Gestion centralisée des erreurs.
// La pile n'est journalisée que pour les erreurs serveur (5xx) : une saisie
// invalide relève du client et n'a pas à polluer les logs.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err.stack);
  }
  res.status(status).json({ message: err.message || 'Erreur serveur' });
});

export default app;
