import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { BroadcastController } from '../modules/notifications/broadcast/broadcast.controller';

const router = Router();

// Require admin or super_admin for all broadcast management
router.use(authenticate, requireRole('super_admin', 'admin'));

// POST /api/v1/admin/broadcast - Launch new broadcast
router.post('/', BroadcastController.createBroadcast);

// GET /api/v1/admin/broadcast - List recent broadcast campaigns
router.get('/', BroadcastController.listBroadcasts);

// GET /api/v1/admin/broadcast/:id - Get specific broadcast campaign stats
router.get('/:id', BroadcastController.getBroadcastStatus);

export default router;
