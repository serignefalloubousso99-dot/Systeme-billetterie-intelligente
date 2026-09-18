import express from 'express';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  bulkUpdateStatus,
  updateUserStatus,
  getDashboardStats,
} from '../controllers/userController.js';
import { importUsers } from '../controllers/importController.js';
import { renvoyerLienConfirmation } from '../controllers/confirmationController.js';
import { uploadCsv } from '../middleware/upload.js';
import { protect, isAdmin, requirePasswordChanged } from '../middleware/auth.js';

const router = express.Router();

// Réservé aux administrateurs ayant déjà remplacé leur mot de passe temporaire
router.use(protect, requirePasswordChanged, isAdmin);

// Statistiques du tableau de bord
router.get('/dashboard/stats', getDashboardStats);

// Importation CSV et actions groupées (avant /:id pour éviter les collisions de route)
router.post('/users/import', uploadCsv, importUsers);
router.patch('/users/bulk-status', bulkUpdateStatus);

// CRUD utilisateurs
router.route('/users').post(createUser).get(getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.post('/users/:id/confirmation/renvoyer', renvoyerLienConfirmation);
router.route('/users/:id').get(getUserById).put(updateUser).delete(deleteUser);

export default router;
