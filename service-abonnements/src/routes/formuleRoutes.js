import express from 'express';
import {
  creerFormule,
  listerFormules,
  obtenirFormule,
  modifierFormule,
  changerActivationFormule,
} from '../controllers/formuleController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Le catalogue est administré : toutes les routes exigent un jeton valide
// et le rôle Administrateur (contrat §4).
router.use(protect, isAdmin);

router.route('/').post(creerFormule).get(listerFormules);
router.patch('/:id/actif', changerActivationFormule);
router.route('/:id').get(obtenirFormule).put(modifierFormule);

export default router;
