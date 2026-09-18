import express from 'express';
import { verifierValidite } from '../controllers/validiteController.js';
import { protect, isSelfOuStaff } from '../middleware/auth.js';

const router = express.Router();

// Ouvert aux agents et administrateurs (contrôle sur le terrain), ainsi
// qu'au client consultant son propre abonnement (voir middleware/auth.js).
router.use(protect);

// isSelfOuStaff dépend de req.params.utilisateurId : il doit être attaché
// directement sur la route, pas via router.use() (params pas encore résolus).
router.get('/:utilisateurId', isSelfOuStaff, verifierValidite);

export default router;
