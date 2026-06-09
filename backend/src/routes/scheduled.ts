import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/orders', authenticate, async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM scheduled_orders WHERE customer_id = $1 AND status = \'scheduled\' ORDER BY scheduled_for ASC',
        [req.user!.userId]
    );
    res.json({ scheduledOrders: rows });
});

router.get('/recurring-plans', authenticate, async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM recurring_meal_plans WHERE customer_id = $1 AND status = \'active\'',
        [req.user!.userId]
    );
    res.json({ recurringPlans: rows });
});

export default router;
