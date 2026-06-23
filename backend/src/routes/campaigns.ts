import express from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import redis, { keys } from '../redis';

const router = express.Router();

const CAMPAIGN_TTL = 30; // 30-second cache — disable reflects within 30s

async function bustCampaignCache() {
    try { await redis.del(keys.activeCampaigns()); } catch (_) {}
}

// ─── CUSTOMER-FACING ────────────────────────────────────────────────────────

// GET /campaigns/active — returns only active campaigns (cached 30s)
// Used by mobile app to show banners, happy hour badge, flash sale countdown
router.get('/active', authenticate, async (req, res) => {
    try {
        const cached = await redis.get(keys.activeCampaigns());
        if (cached) return res.json(JSON.parse(cached));

        const now = new Date();
        const { rows } = await query(`
            SELECT id, name, type, discount_type, discount_percent, discount_flat_paise,
                   max_discount_paise, min_order_paise, flash_start, flash_end,
                   happy_hour_start, happy_hour_end, happy_hour_days, config
            FROM campaigns
            WHERE is_active = true
            AND (
              -- Flash sale: only within its window
              (type = 'flash_sale' AND flash_start <= NOW() AND flash_end >= NOW())
              OR
              -- All other types: always active when toggled on
              type != 'flash_sale'
            )
            ORDER BY type, created_at DESC
        `);

        const payload = { campaigns: rows };
        await redis.setEx(keys.activeCampaigns(), CAMPAIGN_TTL, JSON.stringify(payload));
        res.json(payload);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// ─── ADMIN ─────────────────────────────────────────────────────────────────

// GET /campaigns — all campaigns for admin dashboard
router.get('/', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT c.*, u.name as created_by_name
            FROM campaigns c
            LEFT JOIN users u ON u.id = c.created_by
            ORDER BY c.type, c.created_at DESC
        `);
        res.json({ campaigns: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// POST /campaigns — create new campaign
router.post('/', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        name, type, is_active, discount_type, discount_percent, discount_flat_paise,
        max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
        happy_hour_start, happy_hour_end, happy_hour_days, config
    } = req.body;
    const userId = req.user?.userId;
    try {
        const { rows } = await query(
            `INSERT INTO campaigns
             (name, type, is_active, discount_type, discount_percent, discount_flat_paise,
              max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
              happy_hour_start, happy_hour_end, happy_hour_days, config, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING *`,
            [
                name, type, is_active ?? true,
                discount_type || 'percentage',
                discount_percent || 0, discount_flat_paise || 0,
                max_discount_paise || null, min_order_paise || 0,
                winback_days || 7,
                flash_start || null, flash_end || null,
                happy_hour_start || null, happy_hour_end || null,
                happy_hour_days || ['mon','tue','wed','thu','fri','sat','sun'],
                config ? JSON.stringify(config) : '{}',
                userId || null
            ]
        );
        await bustCampaignCache();
        res.status(201).json({ campaign: rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// PATCH /campaigns/:id — update campaign (including enable/disable toggle)
// When is_active=false → cache busted immediately → users stop seeing it within seconds
router.patch('/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        name, is_active, discount_type, discount_percent, discount_flat_paise,
        max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
        happy_hour_start, happy_hour_end, happy_hour_days, config
    } = req.body;
    try {
        const { rows } = await query(
            `UPDATE campaigns
             SET name                = COALESCE($1,  name),
                 is_active           = COALESCE($2,  is_active),
                 discount_type       = COALESCE($3,  discount_type),
                 discount_percent    = COALESCE($4,  discount_percent),
                 discount_flat_paise = COALESCE($5,  discount_flat_paise),
                 max_discount_paise  = COALESCE($6,  max_discount_paise),
                 min_order_paise     = COALESCE($7,  min_order_paise),
                 winback_days        = COALESCE($8,  winback_days),
                 flash_start         = COALESCE($9,  flash_start),
                 flash_end           = COALESCE($10, flash_end),
                 happy_hour_start    = COALESCE($11, happy_hour_start),
                 happy_hour_end      = COALESCE($12, happy_hour_end),
                 happy_hour_days     = COALESCE($13, happy_hour_days),
                 config              = COALESCE($14, config),
                 updated_at          = NOW()
             WHERE id = $15
             RETURNING *`,
            [
                name, is_active, discount_type, discount_percent, discount_flat_paise,
                max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
                happy_hour_start, happy_hour_end,
                happy_hour_days ? JSON.stringify(happy_hour_days) : null,
                config ? JSON.stringify(config) : null,
                id
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
        await bustCampaignCache(); // immediately removes from user view if disabled
        res.json({ campaign: rows[0] });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

// DELETE /campaigns/:id
router.delete('/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM campaigns WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Campaign not found' });
        await bustCampaignCache();
        res.json({ message: 'Campaign deleted' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

export default router;
