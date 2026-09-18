import express from 'express';
import { getStatistiques } from '../controllers/statistiquesController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, isAdmin);

router.get('/stats', getStatistiques);

export default router;
