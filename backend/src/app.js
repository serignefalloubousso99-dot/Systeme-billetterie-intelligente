import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Application Express sans écoute réseau ni connexion base :
// server.js s'en charge en production, les tests l'utilisent directement.
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'success',
    message: 'Backend API is running and connected to MongoDB',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Photos de profil téléversées (accessibles publiquement en lecture)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes du Service Utilisateurs
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Middleware global de gestion des erreurs (ex. erreurs Multer)
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur' });
});

export default app;
