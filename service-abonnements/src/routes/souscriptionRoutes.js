import express from 'express';
import {
  souscrire,
  listerSouscriptions,
  obtenirSouscription,
  changerStatut,
  renouveler,
} from '../controllers/souscriptionController.js';
import { consommerVoyage, historiqueVoyages } from '../controllers/consommationController.js';
import { protect, isAdmin, isAdminOuAgent } from '../middleware/auth.js';

const router = express.Router();

// Gestion des souscriptions : reservee aux administrateurs (contrat §4)
router.use(protect);

router.route('/').post(isAdmin, souscrire).get(isAdmin, listerSouscriptions);

// Declarees avant /:id pour eviter que ces segments soient pris pour un identifiant
router.patch('/:id/statut', isAdmin, changerStatut);
router.post('/:id/renouveler', isAdmin, renouveler);
// Consommer un voyage et consulter l'historique : c'est l'agent sur le
// terrain qui scanne, pas l'administrateur (voir isAdminOuAgent).
router.post('/:id/consommer', isAdminOuAgent, consommerVoyage);
router.get('/:id/historique', isAdminOuAgent, historiqueVoyages);

router.get('/:id', isAdmin, obtenirSouscription);

export default router;
