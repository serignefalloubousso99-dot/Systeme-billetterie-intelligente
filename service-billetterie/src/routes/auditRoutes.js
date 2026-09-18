import express from 'express';
import { listerAudits, getAuditById } from '../controllers/auditController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, isAdmin);

router.get('/', listerAudits);
router.get('/:id', getAuditById);

export default router;
