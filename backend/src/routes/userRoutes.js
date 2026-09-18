import express from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePhoto,
} from '../controllers/profileController.js';
import { lookupUsers } from '../controllers/userController.js';
import { protect, requirePasswordChanged, isAdminOrAgent } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';

const router = express.Router();

// Toutes les routes de profil nécessitent d'être connecté
router.use(protect);

// Accessibles même avec un mot de passe temporaire :
// consulter son profil et remplacer le mot de passe.
router.get('/profile', getProfile);
router.put('/profile/password', changePassword);

// Identité minimale de comptes (ex: nom du client sur un titre de
// transport), réservée au personnel de contrôle.
router.get('/lookup', requirePasswordChanged, isAdminOrAgent, lookupUsers);

// Nécessitent d'avoir déjà changé le mot de passe temporaire
router.put('/profile', requirePasswordChanged, updateProfile);
router.post('/profile/photo', requirePasswordChanged, uploadPhoto, uploadProfilePhoto);

export default router;
