import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import redis, { keys } from '../redis';

const router = express.Router();
import { emitToAdmin, emitToAll } from '../socket';

const PROMO_TTL = 30; // 30-second cache — admin disable reflects within 30s

async function bustPromoCache() {
    try { await redis.del(keys.activePromos()); } catch (_) {}
}

// GET all promo codes (admin only)
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM promo_codes ORDER BY created_at DESC');
        res.json({ promoCodes: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch promo codes' });
    }
});

// GET active promo codes (customer-facing) — Redis cached 30s
router.get('/active', authenticate, async (req, res) => {
    try {
        const cached = await redis.get(keys.activePromos());
        if (cached) return res.json(JSON.parse(cached));

        const { rows } = await query(`
            SELECT id, code, discount_type, discount_percent, discount_flat_paise,
                   max_discount_paise, min_order_paise, expires_at, description,
                   first_order_only, new_user_only, per_user_limit
            FROM promo_codes
            WHERE is_active = true
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
        `);
        const payload = { promoCodes: rows };
        await redis.setEx(keys.activePromos(), PROMO_TTL, JSON.stringify(payload));
        res.json(payload);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch active promo codes' });
    }
});

// CREATE new promo code (admin)
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        code, discount_type, discount_percent, discount_flat_paise,
        min_order_paise, max_discount_paise, expires_at, max_uses,
        is_active, first_order_only, new_user_only, per_user_limit, description
    } = req.body;
    try {
        const { rows } = await query(
            `INSERT INTO promo_codes
            (code, discount_type, discount_percent, discount_flat_paise, min_order_paise,
             max_discount_paise, expires_at, max_uses, is_active, first_order_only,
             new_user_only, per_user_limit, description)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *`,
            [
                code.toUpperCase(),
                discount_type || 'percentage',
                discount_percent || 0,
                discount_flat_paise || 0,
                min_order_paise || 0,
                max_discount_paise || null,
                expires_at || null,
                max_uses || null,
                is_active ?? true,
                first_order_only ?? false,
                new_user_only ?? false,
                per_user_limit || null,
                description || null
            ]
        );
        await bustPromoCache();
        emitToAdmin('promo_updated', { type: 'add' });
        emitToAll('promo_updated', { type: 'add' });
        res.status(201).json({ promoCode: rows[0] });
    } catch (err: any) {
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: 'Promo code already exists' });
        res.status(500).json({ error: 'Failed to create promo code' });
    }
});

// UPDATE promo code (admin) — toggling is_active immediately busts cache
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        code, discount_type, discount_percent, discount_flat_paise,
        min_order_paise, max_discount_paise, expires_at, max_uses,
        is_active, first_order_only, new_user_only, per_user_limit, description
    } = req.body;
    try {
        const { rows } = await query(
            `UPDATE promo_codes
             SET code                = COALESCE($1,  code),
                 discount_type       = COALESCE($2,  discount_type),
                 discount_percent    = COALESCE($3,  discount_percent),
                 discount_flat_paise = COALESCE($4,  discount_flat_paise),
                 min_order_paise     = COALESCE($5,  min_order_paise),
                 max_discount_paise  = COALESCE($6,  max_discount_paise),
                 expires_at          = COALESCE($7,  expires_at),
                 max_uses            = COALESCE($8,  max_uses),
                 is_active           = COALESCE($9,  is_active),
                 first_order_only    = COALESCE($10, first_order_only),
                 new_user_only       = COALESCE($11, new_user_only),
                 per_user_limit      = COALESCE($12, per_user_limit),
                 description         = COALESCE($13, description),
                 updated_at          = NOW()
             WHERE id = $14
             RETURNING *`,
            [
                code ? code.toUpperCase() : null,
                discount_type, discount_percent, discount_flat_paise,
                min_order_paise, max_discount_paise, expires_at, max_uses,
                is_active, first_order_only, new_user_only, per_user_limit,
                description, id
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
        await bustPromoCache(); // instant bust — disabled codes vanish from app within seconds
        emitToAdmin('promo_updated', { type: 'update' });
        emitToAll('promo_updated', { type: 'update' });
        res.json({ promoCode: rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update promo code' });
    }
});

// DELETE promo code (admin)
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM promo_codes WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Promo code not found' });
        await bustPromoCache();
        emitToAdmin('promo_updated', { type: 'delete' });
        emitToAll('promo_updated', { type: 'delete' });
        res.json({ message: 'Promo code deleted successfully' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete promo code' });
    }
});

export default router;
