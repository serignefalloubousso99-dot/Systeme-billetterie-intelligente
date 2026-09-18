import express from 'express';
import {
  scannerValidation,
  listerValidations,
  getValidationById,
} from '../controllers/validationController.js';
import { protect, isAgentOrAdmin } from '../middleware/auth.js';
import { validationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(protect);

router.post('/scan', isAgentOrAdmin, validationLimiter, scannerValidation);
router.get('/', isAgentOrAdmin, listerValidations);
router.get('/:id', isAgentOrAdmin, getValidationById);

export default router;
