import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { emitToAll } from '../socket';

const router = express.Router();

const VALID_AUDIENCES = ['all','new_users','plus_subscribers','loyal','at_risk','churned','high_spenders'];

const clearMenuCache = async () => {
    try {
        const { redis } = require('../redis');
        if (redis) {
            const keys = await redis.keys('menu:customer:*');
            if (keys && keys.length > 0) {
                await redis.del(...keys);
            }
        }
    } catch (e) {
        console.error('Failed to clear menu cache:', e);
    }
};

// ── Customer: active offers for zone ──────────────────────────────────────────
router.get('/active', async (req, res) => {
    const zoneId = req.query.zoneId as string | undefined;
    try {
        const { rows } = await query(`
            SELECT id, title, description, target_type, target_id, target_ids,
                   discount_type, discount_percent, discount_flat_paise, max_discount_paise,
                   audience, zone_id, start_time, end_time, per_user_limit, max_items_per_order, limit_reset_period
            FROM menu_offers
            WHERE is_active = true
            AND (zone_id IS NULL OR zone_id = $1)
            AND (start_time IS NULL OR start_time <= NOW())
            AND (end_time IS NULL OR end_time >= NOW())
            ORDER BY discount_percent DESC NULLS LAST, discount_flat_paise DESC NULLS LAST
        `, [zoneId || null]);
        res.json({ offers: rows });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch offers' });
    }
});

// ── Admin: list ────────────────────────────────────────────────────────────────
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (_req, res) => {
    try {
        const { rows } = await query(`
            SELECT o.*, z.name AS zone_name,
                   (
                     SELECT ARRAY_AGG(m.name)
                     FROM menu_items m
                     WHERE m.id = ANY(o.target_ids)
                   ) AS target_names,
                   CASE 
                     WHEN o.target_type = 'item' THEN (SELECT name FROM menu_items WHERE id = o.target_id)
                     WHEN o.target_type = 'category' THEN (SELECT name FROM menu_categories WHERE id = o.target_id)
                     WHEN o.target_type = 'kitchen' THEN (SELECT name FROM kitchens WHERE id = o.target_id)
                     ELSE NULL
                   END AS target_name
            FROM menu_offers o
            LEFT JOIN zones z ON o.zone_id = z.id
            ORDER BY o.created_at DESC
        `);
        res.json({ offers: rows });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch menu offers' });
    }
});

// ── Admin: create ──────────────────────────────────────────────────────────────
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        title, description, target_type, target_id, target_ids,
        discount_type, discount_percent, discount_flat_paise, max_discount_paise,
        audience, audience_config, zone_id, start_time, end_time, is_active,
        per_user_limit, max_items_per_order, limit_reset_period
    } = req.body;

    if (!title || !target_type || !discount_type) {
        return res.status(400).json({ error: 'title, target_type, and discount_type are required' });
    }
    if (!['all', 'kitchen', 'category', 'item'].includes(target_type)) {
        return res.status(400).json({ error: 'target_type must be all | kitchen | category | item' });
    }
    if (!['flat', 'percent', 'percentage', 'bogo'].includes(discount_type)) {
        return res.status(400).json({ error: 'discount_type must be flat | percent | bogo' });
    }
    if (audience && !VALID_AUDIENCES.includes(audience)) {
        return res.status(400).json({ error: `audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }

    // Normalise discount_type to match DB constraint ('percent' → 'percentage')
    const normalizedDiscountType = discount_type === 'percent' ? 'percentage' : discount_type;

    // Normalise: if multi-select array provided, derive single target_id from first element
    const resolvedTargetId = target_id || (Array.isArray(target_ids) && target_ids[0]) || null;
    const resolvedTargetIds = Array.isArray(target_ids) && target_ids.length > 0 ? target_ids : null;

    try {
        const { rows } = await query(`
            INSERT INTO menu_offers
                (title, description, target_type, target_id, target_ids,
                 discount_type, discount_percent, discount_flat_paise, max_discount_paise,
                 audience, audience_config, zone_id, start_time, end_time, is_active,
                 per_user_limit, max_items_per_order, limit_reset_period)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING *
        `, [
            title, description || null, target_type,
            resolvedTargetId, resolvedTargetIds,
            normalizedDiscountType, discount_percent || 0, discount_flat_paise || 0,
            max_discount_paise || null,
            audience || 'all',
            audience_config ? JSON.stringify(audience_config) : '{}',
            zone_id || null, start_time || null, end_time || null,
            is_active ?? true,
            per_user_limit ? Number(per_user_limit) : null,
            max_items_per_order ? Number(max_items_per_order) : null,
            limit_reset_period || 'lifetime'
        ]);
        await clearMenuCache();
        emitToAll('offer_updated', { action: 'create', offerId: rows[0].id });
        res.status(201).json({ offer: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create menu offer', details: err.message });
    }
});

// ── Admin: update ──────────────────────────────────────────────────────────────
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        title, description, target_type, target_id, target_ids,
        discount_type, discount_percent, discount_flat_paise, max_discount_paise,
        audience, audience_config, zone_id, start_time, end_time, is_active,
        per_user_limit, max_items_per_order, limit_reset_period
    } = req.body;

    const resolvedTargetId = target_id !== undefined ? target_id
        : (Array.isArray(target_ids) && target_ids[0]) || undefined;
    const resolvedTargetIds = Array.isArray(target_ids) && target_ids.length > 0 ? target_ids : null;
    const normalizedDiscountType = discount_type === 'percent' ? 'percentage' : (discount_type ?? null);

    const hasDescription = description !== undefined;
    const hasTargetId = target_id !== undefined || target_ids !== undefined;
    const hasTargetIds = target_ids !== undefined;
    const hasMaxDiscount = max_discount_paise !== undefined;
    const hasZoneId = zone_id !== undefined;
    const hasStartTime = start_time !== undefined;
    const hasEndTime = end_time !== undefined;
    const hasPerUserLimit = per_user_limit !== undefined;
    const hasMaxItems = max_items_per_order !== undefined;

    try {
        const { rows } = await query(`
            UPDATE menu_offers SET
                title               = COALESCE($1,  title),
                description         = CASE WHEN $20 THEN $2 ELSE description END,
                target_type         = COALESCE($3,  target_type),
                target_id           = CASE WHEN $21 THEN $4 ELSE target_id END,
                target_ids          = CASE WHEN $22 THEN $5 ELSE target_ids END,
                discount_type       = COALESCE($6,  discount_type),
                discount_percent    = COALESCE($7,  discount_percent),
                discount_flat_paise = COALESCE($8,  discount_flat_paise),
                max_discount_paise  = CASE WHEN $23 THEN $9 ELSE max_discount_paise END,
                audience            = COALESCE($10, audience),
                audience_config     = COALESCE($11, audience_config),
                zone_id             = CASE WHEN $24 THEN $12 ELSE zone_id END,
                start_time          = CASE WHEN $25 THEN $13 ELSE start_time END,
                end_time            = CASE WHEN $26 THEN $14 ELSE end_time END,
                is_active           = COALESCE($15, is_active),
                per_user_limit      = CASE WHEN $27 THEN $16 ELSE per_user_limit END,
                max_items_per_order = CASE WHEN $28 THEN $17 ELSE max_items_per_order END,
                limit_reset_period  = COALESCE($18, limit_reset_period),
                updated_at          = NOW()
            WHERE id = $19
            RETURNING *
        `, [
            title ?? null,
            description || null,
            target_type ?? null,
            resolvedTargetId || null,
            resolvedTargetIds,
            normalizedDiscountType,
            discount_percent ?? null,
            discount_flat_paise ?? null,
            max_discount_paise ? Number(max_discount_paise) : null,
            audience ?? null,
            audience_config ? JSON.stringify(audience_config) : null,
            zone_id || null,
            start_time || null,
            end_time || null,
            is_active ?? null,
            per_user_limit ? Number(per_user_limit) : null,
            max_items_per_order ? Number(max_items_per_order) : null,
            limit_reset_period ?? null,
            id,
            hasDescription,
            hasTargetId,
            hasTargetIds,
            hasMaxDiscount,
            hasZoneId,
            hasStartTime,
            hasEndTime,
            hasPerUserLimit,
            hasMaxItems,
        ]);
        if (rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
        await clearMenuCache();
        emitToAll('offer_updated', { action: 'update', offerId: id });
        res.json({ offer: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update menu offer', details: err.message });
    }
});

// ── Admin: delete ──────────────────────────────────────────────────────────────
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM menu_offers WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Offer not found' });
        await clearMenuCache();
        emitToAll('offer_updated', { action: 'delete', offerId: id });
        res.json({ message: 'Offer deleted' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete menu offer' });
    }
});

export default router;
