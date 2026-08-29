import express from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToAll } from '../socket';

const router = express.Router();

// GET all active banners (public / customer app)
// Optional ?zoneId=... or ?zone_id=... returns global banners (zone_id IS NULL) + zone-specific banners
router.get('/', async (req, res) => {
    try {
        const zoneId = (req.query.zoneId || req.query.zone_id) as string | undefined;
        const { rows } = await query(
            `SELECT pb.*, z.name AS zone_name
             FROM promotional_banners pb
             LEFT JOIN zones z ON pb.zone_id = z.id
             WHERE pb.is_active = true
               AND ($1::uuid IS NULL OR pb.zone_id IS NULL OR pb.zone_id = $1::uuid)
             ORDER BY pb.display_order ASC, pb.created_at DESC`,
            [zoneId || null]
        );
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({ banners: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// GET all banners (admin)
// Optional ?zoneId=... filters by specific zone; omitting or passing empty returns all banners
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const zoneId = (req.query.zoneId || req.query.zone_id) as string | undefined;
        const { rows } = await query(
            `SELECT pb.*, z.name AS zone_name
             FROM promotional_banners pb
             LEFT JOIN zones z ON pb.zone_id = z.id
             WHERE ($1::uuid IS NULL OR pb.zone_id = $1::uuid)
             ORDER BY pb.display_order ASC, pb.created_at DESC`,
            [zoneId || null]
        );
        res.json({ banners: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// CREATE new banner (admin)
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        title,
        subtitle,
        tag_text,
        image_url,
        video_url,
        media_type,
        action_type,
        action_payload,
        is_active,
        display_order,
        banner_type,
        slide_duration_ms,
        zone_id,
        zoneId,
    } = req.body;

    const targetZoneId = (zone_id !== undefined ? zone_id : zoneId) || null;

    try {
        const { rows } = await query(
            `INSERT INTO promotional_banners
            (title, subtitle, tag_text, image_url, video_url, media_type, action_type, action_payload, is_active, display_order, banner_type, slide_duration_ms, zone_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                title,
                subtitle,
                tag_text,
                image_url,
                video_url || null,
                media_type || 'IMAGE',
                action_type || 'NONE',
                action_payload || '',
                is_active ?? true,
                display_order ?? 0,
                banner_type || 'MAIN',
                slide_duration_ms ?? 3000,
                targetZoneId,
            ]
        );

        // Fetch with zone_name
        const { rows: fullRows } = await query(
            `SELECT pb.*, z.name AS zone_name
             FROM promotional_banners pb
             LEFT JOIN zones z ON pb.zone_id = z.id
             WHERE pb.id = $1`,
            [rows[0].id]
        );

        emitToAll('banner_updated', { action: 'create', bannerId: rows[0].id });
        res.status(201).json({ banner: fullRows[0] || rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create banner' });
    }
});

// UPDATE banner (admin)
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        title,
        subtitle,
        tag_text,
        image_url,
        video_url,
        media_type,
        action_type,
        action_payload,
        is_active,
        display_order,
        banner_type,
        slide_duration_ms,
    } = req.body;

    const hasZoneId = 'zone_id' in req.body || 'zoneId' in req.body;
    const targetZoneId = hasZoneId ? ((req.body.zone_id !== undefined ? req.body.zone_id : req.body.zoneId) || null) : undefined;

    try {
        const { rows } = await query(
            `UPDATE promotional_banners
             SET title = COALESCE($1, title),
                 subtitle = COALESCE($2, subtitle),
                 tag_text = COALESCE($3, tag_text),
                 image_url = COALESCE($4, image_url),
                 video_url = COALESCE($5, video_url),
                 media_type = COALESCE($6, media_type),
                 action_type = COALESCE($7, action_type),
                 action_payload = COALESCE($8, action_payload),
                 is_active = COALESCE($9, is_active),
                 display_order = COALESCE($10, display_order),
                 banner_type = COALESCE($11, banner_type),
                 slide_duration_ms = COALESCE($12, slide_duration_ms),
                 zone_id = CASE WHEN $13::boolean THEN $14::uuid ELSE zone_id END,
                 updated_at = NOW()
             WHERE id = $15
             RETURNING *`,
            [
                title,
                subtitle,
                tag_text,
                image_url,
                video_url,
                media_type,
                action_type,
                action_payload,
                is_active,
                display_order,
                banner_type,
                slide_duration_ms,
                hasZoneId,
                targetZoneId || null,
                id,
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });

        const { rows: fullRows } = await query(
            `SELECT pb.*, z.name AS zone_name
             FROM promotional_banners pb
             LEFT JOIN zones z ON pb.zone_id = z.id
             WHERE pb.id = $1`,
            [id]
        );

        emitToAll('banner_updated', { action: 'update', bannerId: id });
        res.json({ banner: fullRows[0] || rows[0] });
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
        emitToAll('banner_updated', { action: 'delete', bannerId: id });
        res.json({ message: 'Banner deleted successfully' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete banner' });
    }
});

export default router;
