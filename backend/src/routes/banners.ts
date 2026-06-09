import express from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET all active banners (public)
router.get('/', async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM promotional_banners WHERE is_active = true ORDER BY display_order ASC, created_at DESC'
        );
        res.json({ banners: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// GET all banners (admin)
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM promotional_banners ORDER BY display_order ASC, created_at DESC'
        );
        res.json({ banners: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// CREATE new banner (admin)
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { title, subtitle, tag_text, image_url, action_type, action_payload, is_active, display_order } = req.body;
    try {
        const { rows } = await query(
            `INSERT INTO promotional_banners 
            (title, subtitle, tag_text, image_url, action_type, action_payload, is_active, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [title, subtitle, tag_text, image_url, action_type || 'NONE', action_payload || '', is_active ?? true, display_order ?? 0]
        );
        res.status(201).json({ banner: rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create banner' });
    }
});

// UPDATE banner (admin)
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const { title, subtitle, tag_text, image_url, action_type, action_payload, is_active, display_order } = req.body;
    try {
        const { rows } = await query(
            `UPDATE promotional_banners 
             SET title = COALESCE($1, title),
                 subtitle = COALESCE($2, subtitle),
                 tag_text = COALESCE($3, tag_text),
                 image_url = COALESCE($4, image_url),
                 action_type = COALESCE($5, action_type),
                 action_payload = COALESCE($6, action_payload),
                 is_active = COALESCE($7, is_active),
                 display_order = COALESCE($8, display_order),
                 updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
            [title, subtitle, tag_text, image_url, action_type, action_payload, is_active, display_order, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });
        res.json({ banner: rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update banner' });
    }
});

// DELETE banner (admin)
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM promotional_banners WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Banner not found' });
        res.json({ message: 'Banner deleted successfully' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete banner' });
    }
});

export default router;
