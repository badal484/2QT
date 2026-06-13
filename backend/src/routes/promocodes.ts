import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

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

// GET active promo codes (public/customer)
router.get('/active', authenticate, async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT id, code, discount_type, discount_percent, max_discount_paise, min_order_paise, expires_at 
            FROM promo_codes 
            WHERE is_active = true 
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
        `);
        res.json({ promoCodes: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch active promo codes' });
    }
});

// CREATE new promo code (admin)
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { code, discount_type, discount_percent, min_order_paise, max_discount_paise, expires_at, max_uses, is_active } = req.body;
    try {
        const { rows } = await query(
            `INSERT INTO promo_codes 
            (code, discount_type, discount_percent, min_order_paise, max_discount_paise, expires_at, max_uses, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [code.toUpperCase(), discount_type || 'percentage', discount_percent || 0, min_order_paise || 0, max_discount_paise || null, expires_at || null, max_uses || null, is_active ?? true]
        );
        res.status(201).json({ promoCode: rows[0] });
    } catch (err: any) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Promo code already exists' });
        }
        res.status(500).json({ error: 'Failed to create promo code' });
    }
});

// UPDATE promo code (admin)
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const { code, discount_type, discount_percent, min_order_paise, max_discount_paise, expires_at, max_uses, is_active } = req.body;
    try {
        const { rows } = await query(
            `UPDATE promo_codes 
             SET code = COALESCE($1, code),
                 discount_type = COALESCE($2, discount_type),
                 discount_percent = COALESCE($3, discount_percent),
                 min_order_paise = COALESCE($4, min_order_paise),
                 max_discount_paise = COALESCE($5, max_discount_paise),
                 expires_at = COALESCE($6, expires_at),
                 max_uses = COALESCE($7, max_uses),
                 is_active = COALESCE($8, is_active),
                 updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
            [code ? code.toUpperCase() : null, discount_type, discount_percent, min_order_paise, max_discount_paise, expires_at, max_uses, is_active, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
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
        res.json({ message: 'Promo code deleted successfully' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete promo code' });
    }
});

export default router;
