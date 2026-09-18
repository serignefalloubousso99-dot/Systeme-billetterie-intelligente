import express from 'express';
import { login, logout } from '../controllers/authController.js';
import { verifierLienConfirmation, confirmerCompte } from '../controllers/confirmationController.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);

// Confirmation de compte : publiques par nature, l'utilisateur n'est pas
// encore connecté. Le jeton fait office d'autorisation.
router.get('/confirmation/:token', verifierLienConfirmation);
router.post('/confirmation/:token', confirmerCompte);

export default router;
