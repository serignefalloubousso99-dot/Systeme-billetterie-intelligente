import express from 'express';
import { obtenirStatistiques } from '../controllers/statistiquesController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Le tableau de bord est un outil de pilotage : réservé aux administrateurs.
router.use(protect, isAdmin);

router.get('/stats', obtenirStatistiques);

export default router;
