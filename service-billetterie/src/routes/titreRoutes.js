import express from 'express';
import {
  creerTitre,
  listerTitres,
  getTitreById,
  changerStatutTitre,
  getTitresParClient,
} from '../controllers/titreController.js';
import { protect, isAdmin, isAgentOrAdmin, isSelfOrStaff } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', isAdmin, creerTitre);
router.get('/', isAgentOrAdmin, listerTitres);
router.get('/client/:utilisateurId', isSelfOrStaff, getTitresParClient);
router.get('/:id', isAgentOrAdmin, getTitreById);
router.patch('/:id/statut', isAdmin, changerStatutTitre);

export default router;
