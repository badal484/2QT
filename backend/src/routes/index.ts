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
import notificationsRoutes from './notifications';
import serviceRequestsRoutes from './service-requests';
// ... other routes

const router = Router();

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
router.use('/notifications', notificationsRoutes);
router.use('/service-requests', serviceRequestsRoutes);
// ...

export default router;
