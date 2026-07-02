import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { emitToAll } from '../socket';

const router = express.Router();

const VALID_AUDIENCES = ['all','new_users','plus_subscribers','loyal','at_risk','churned','high_spenders'];

// ── Customer: active offers for zone ──────────────────────────────────────────
router.get('/active', async (req, res) => {
    const zoneId = req.query.zoneId as string | undefined;
    try {
        const { rows } = await query(`
            SELECT id, title, description, target_type, target_id, target_ids,
                   discount_type, discount_percent, discount_flat_paise, max_discount_paise,
                   audience, zone_id, start_time, end_time
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
            SELECT o.*, z.name AS zone_name
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
        audience, audience_config, zone_id, start_time, end_time, is_active
    } = req.body;

    if (!title || !target_type || !discount_type) {
        return res.status(400).json({ error: 'title, target_type, and discount_type are required' });
    }
    if (!['all', 'kitchen', 'category', 'item'].includes(target_type)) {
        return res.status(400).json({ error: 'target_type must be all | kitchen | category | item' });
    }
    if (!['flat', 'percent', 'percentage'].includes(discount_type)) {
        return res.status(400).json({ error: 'discount_type must be flat | percent' });
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
                 audience, audience_config, zone_id, start_time, end_time, is_active)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
        ]);
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
        audience, audience_config, zone_id, start_time, end_time, is_active
    } = req.body;

    const resolvedTargetId = target_id !== undefined ? target_id
        : (Array.isArray(target_ids) && target_ids[0]) || undefined;
    const resolvedTargetIds = Array.isArray(target_ids) && target_ids.length > 0 ? target_ids : null;
    const normalizedDiscountType = discount_type === 'percent' ? 'percentage' : (discount_type ?? null);

    try {
        const { rows } = await query(`
            UPDATE menu_offers SET
                title               = COALESCE($1,  title),
                description         = COALESCE($2,  description),
                target_type         = COALESCE($3,  target_type),
                target_id           = COALESCE($4,  target_id),
                target_ids          = COALESCE($5,  target_ids),
                discount_type       = COALESCE($6,  discount_type),
                discount_percent    = COALESCE($7,  discount_percent),
                discount_flat_paise = COALESCE($8,  discount_flat_paise),
                max_discount_paise  = COALESCE($9,  max_discount_paise),
                audience            = COALESCE($10, audience),
                audience_config     = COALESCE($11, audience_config),
                zone_id             = COALESCE($12, zone_id),
                start_time          = COALESCE($13, start_time),
                end_time            = COALESCE($14, end_time),
                is_active           = COALESCE($15, is_active),
                updated_at          = NOW()
            WHERE id = $16
            RETURNING *
        `, [
            title ?? null, description ?? null, target_type ?? null,
            resolvedTargetId ?? null,
            resolvedTargetIds,
            normalizedDiscountType, discount_percent ?? null, discount_flat_paise ?? null,
            max_discount_paise ?? null,
            audience ?? null,
            audience_config ? JSON.stringify(audience_config) : null,
            zone_id ?? null, start_time ?? null, end_time ?? null,
            is_active ?? null, id,
        ]);
        if (rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
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
        emitToAll('offer_updated', { action: 'delete', offerId: id });
        res.json({ message: 'Offer deleted' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete menu offer' });
    }
});

export default router;
