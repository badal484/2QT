import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { DeviceTokenController } from '../modules/notifications/controllers/device-token.controller';

const router = Router();

// POST /api/v1/device-tokens - Register or refresh device token
router.post('/', authenticate, DeviceTokenController.registerToken);

// DELETE /api/v1/device-tokens - Deactivate device token on logout
router.delete('/', authenticate, DeviceTokenController.deactivateToken);

export default router;
