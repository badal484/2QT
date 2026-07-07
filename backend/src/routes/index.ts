import { Router } from 'express';
import adminRoutes from './admin';
import appRoutes from './app';
import authRoutes from './auth';
import customerRoutes from './customer';
import kitchenRoutes from './kitchen';
import menuRoutes from './menu';
import orderRoutes from './order';
import paymentRoutes from './payment';
import riderRoutes from './rider';
import scheduledRoutes from './scheduled';
import subscriptionRoutes from './subscription';
import uploadRoutes from './upload';
import webhookRoutes from './webhooks';
import bannersRoutes from './banners';
import categoriesRoutes from './categories';
import notificationsRoutes from './notifications';
import serviceRequestsRoutes from './service-requests';
import promocodesRoutes from './promocodes';
import financeRoutes from './finance';
import campaignsRoutes from './campaigns';
import complaintsRoutes from './complaints';
import homeRoutes from './home';
import collectionsRoutes from './collections';
import menuOffersRoutes from './menu-offers';
import restaurantsRoutes from './restaurants';
import tableBookingsRoutes from './table-bookings';
import partnerRoutes from './partner';
// ... other routes

import { ActivityLogService } from '../services/activity.service';
import db from '../db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Global Team Activity Logger Middleware
router.use((req, res, next) => {
    // We only care about mutating actions from staff (admin, kitchen, finance, rider)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const authReq = req as AuthRequest;
                if (!authReq.user) return; // Not authenticated
                const { userId, role } = authReq.user;
                if (role === 'customer') return; // Don't log normal customer actions here

                try {
                    // Fetch real name
                    const { rows } = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
                    const userName = rows[0]?.name || 'Unknown Staff';

                    // Heuristics for entity type
                    let entityType = 'SYSTEM';
                    let entityId = undefined;
                    const parts = req.path.split('/').filter(Boolean);
                    
                    if (parts.includes('orders')) entityType = 'ORDER';
                    else if (parts.includes('users') || parts.includes('team') || parts.includes('staff') || parts.includes('riders')) entityType = 'USER';
                    else if (parts.includes('menu')) entityType = 'MENU_ITEM';
                    else if (parts.includes('kitchens')) entityType = 'KITCHEN';
                    else if (parts.includes('payouts')) entityType = 'PAYOUT';
                    else if (parts.includes('scheduled-orders')) entityType = 'SCHEDULED_ORDER';

                    // Basic UUID extractor for entityId
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    const foundId = parts.find(p => uuidRegex.test(p));
                    if (foundId) entityId = foundId;

                    let actionType = `${req.method}_${parts[parts.length - 1]}`.toUpperCase();
                    if (uuidRegex.test(parts[parts.length - 1])) {
                        actionType = `${req.method}_${entityType}`.toUpperCase();
                    }

                    await ActivityLogService.log({
                        userId,
                        userName,
                        userRole: role,
                        actionType,
                        entityType,
                        entityId,
                        details: { path: req.originalUrl }
                    });
                } catch (e) {
                    console.error('Failed to log activity interceptor', e);
                }
            }
        });
    }
    next();
});

router.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

router.use('/home', homeRoutes);
router.use('/collections', collectionsRoutes);
router.use('/admin', adminRoutes);
router.use('/app', appRoutes);
router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/kitchen', kitchenRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment', paymentRoutes);
router.use('/riders', riderRoutes);
router.use('/scheduled', scheduledRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/upload', uploadRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/banners', bannersRoutes);
router.use('/categories', categoriesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/service-requests', serviceRequestsRoutes);
router.use('/promocodes', promocodesRoutes);
router.use('/finance', financeRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/complaints', complaintsRoutes);
router.use('/menu-offers', menuOffersRoutes);
router.use('/restaurants', restaurantsRoutes);
router.use('/table-bookings', tableBookingsRoutes);
router.use('/partner', partnerRoutes);
// ...

export default router;
