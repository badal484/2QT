import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

// ── Customer: active offers for zone (cached, no auth required) ───────────────
router.get('/active', async (req, res) => {
    const zoneId = req.query.zoneId as string | undefined;
    try {
        const { rows } = await query(`
            SELECT id, title, description, target_type, target_id,
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

// ── Admin: list all offers ────────────────────────────────────────────────────
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

// ── Admin: create offer ───────────────────────────────────────────────────────
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        title, description, target_type, target_id,
        discount_type, discount_percent, discount_flat_paise, max_discount_paise,
        audience, zone_id, start_time, end_time, is_active
    } = req.body;

    if (!title || !target_type || !discount_type) {
        return res.status(400).json({ error: 'title, target_type, and discount_type are required' });
    }
    if (!['all', 'kitchen', 'category', 'item'].includes(target_type)) {
        return res.status(400).json({ error: 'target_type must be all | kitchen | category | item' });
    }
    if (!['flat', 'percent'].includes(discount_type)) {
        return res.status(400).json({ error: 'discount_type must be flat | percent' });
    }

    try {
        const { rows } = await query(`
            INSERT INTO menu_offers
                (title, description, target_type, target_id,
                 discount_type, discount_percent, discount_flat_paise, max_discount_paise,
                 audience, zone_id, start_time, end_time, is_active)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *
        `, [
            title, description || null, target_type, target_id || null,
            discount_type, discount_percent || 0, discount_flat_paise || 0,
            max_discount_paise || null,
            audience || 'all', zone_id || null,
            start_time || null, end_time || null,
            is_active ?? true,
        ]);
        res.status(201).json({ offer: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create menu offer', details: err.message });
    }
});

// ── Admin: update offer ───────────────────────────────────────────────────────
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        title, description, target_type, target_id,
        discount_type, discount_percent, discount_flat_paise, max_discount_paise,
        audience, zone_id, start_time, end_time, is_active
    } = req.body;

    try {
        const { rows } = await query(`
            UPDATE menu_offers SET
                title               = COALESCE($1,  title),
                description         = COALESCE($2,  description),
                target_type         = COALESCE($3,  target_type),
                target_id           = COALESCE($4,  target_id),
                discount_type       = COALESCE($5,  discount_type),
                discount_percent    = COALESCE($6,  discount_percent),
                discount_flat_paise = COALESCE($7,  discount_flat_paise),
                max_discount_paise  = COALESCE($8,  max_discount_paise),
                audience            = COALESCE($9,  audience),
                zone_id             = COALESCE($10, zone_id),
                start_time          = COALESCE($11, start_time),
                end_time            = COALESCE($12, end_time),
                is_active           = COALESCE($13, is_active),
                updated_at          = NOW()
            WHERE id = $14
            RETURNING *
        `, [
            title, description, target_type, target_id,
            discount_type, discount_percent, discount_flat_paise, max_discount_paise,
            audience, zone_id, start_time, end_time, is_active, id
        ]);
        if (rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
        res.json({ offer: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update menu offer', details: err.message });
    }
});

// ── Admin: delete offer ───────────────────────────────────────────────────────
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM menu_offers WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Offer not found' });
        res.json({ message: 'Offer deleted' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete menu offer' });
    }
});

export default router;
