import express from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import redis, { keys } from '../redis';
import { sendNotification, NotifType } from '../services/notification.service';

const router = express.Router();

const CAMPAIGN_TTL = 30;

async function bustCampaignCache() {
    try { await redis.del(keys.activeCampaigns()); } catch (_) {}
}

// Resolve audience for a campaign and send the configured notification template
export async function fireCampaignNotification(campaign: any) {
    if (!campaign.notif_template_type) return;

    // Build user ID list based on audience
    let userQuery = `SELECT id FROM users WHERE role IN ('customer','buyer') AND is_active = TRUE`;
    const params: any[] = [];

    if (campaign.audience_type === 'segment' && campaign.audience_segment) {
        switch (campaign.audience_segment) {
            case 'new_users':
                userQuery += ` AND created_at >= NOW() - INTERVAL '7 days'`; break;
            case 'active':
                userQuery += ` AND id IN (SELECT customer_id FROM orders WHERE status='delivered' GROUP BY customer_id HAVING MAX(created_at) >= NOW() - INTERVAL '14 days')`; break;
            case 'at_risk':
                userQuery += ` AND id IN (SELECT customer_id FROM orders WHERE status='delivered' GROUP BY customer_id HAVING MAX(created_at) BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days')`; break;
            case 'churned':
                userQuery += ` AND id IN (SELECT customer_id FROM orders WHERE status='delivered' GROUP BY customer_id HAVING MAX(created_at) < NOW() - INTERVAL '30 days')`; break;
            case 'loyal':
                userQuery += ` AND id IN (SELECT customer_id FROM orders WHERE status='delivered' GROUP BY customer_id HAVING COUNT(*) >= 10)`; break;
            case 'subscribers':
                userQuery += ` AND id IN (SELECT customer_id FROM subscriptions WHERE is_active=TRUE)`; break;
        }
    }

    const { rows: users } = await query(userQuery, params);
    const BATCH = 50;
    for (let i = 0; i < users.length; i += BATCH) {
        await Promise.allSettled(
            users.slice(i, i + BATCH).map(u =>
                sendNotification(campaign.notif_template_type as NotifType, {
                    userId: u.id,
                    overrideChannels: ['push', 'whatsapp'],
                    dedupeKey: `campaign:${campaign.id}:${u.id}`,
                })
            )
        );
    }

    // Mark as sent + record reach
    await query(
        `UPDATE campaigns SET notif_sent_at = NOW(), reach_count = $1 WHERE id = $2`,
        [users.length, campaign.id]
    );
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
router.post('/', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const {
        name, type, is_active, discount_type, discount_percent, discount_flat_paise,
        max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
        happy_hour_start, happy_hour_end, happy_hour_days, config,
        zone_id, audience_type, audience_segment, schedule_start, schedule_end,
    } = req.body;
    const userId = req.user?.userId;
    try {
        const { rows } = await query(
            `INSERT INTO campaigns
             (name, type, is_active, discount_type, discount_percent, discount_flat_paise,
              max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
              happy_hour_start, happy_hour_end, happy_hour_days, config, created_by,
              zone_id, audience_type, audience_segment, schedule_start, schedule_end)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
             RETURNING *`,
            [
                name, type, is_active ?? false,
                discount_type || 'percentage',
                discount_percent || 0, discount_flat_paise || 0,
                max_discount_paise || null, min_order_paise || 0,
                winback_days || 7,
                flash_start || null, flash_end || null,
                happy_hour_start || null, happy_hour_end || null,
                happy_hour_days || ['mon','tue','wed','thu','fri','sat','sun'],
                config ? JSON.stringify(config) : '{}',
                userId || null,
                zone_id || null,
                audience_type || 'all',
                audience_segment || null,
                schedule_start || null,
                schedule_end || null,
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
router.patch('/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const {
        name, is_active, discount_type, discount_percent, discount_flat_paise,
        max_discount_paise, min_order_paise, winback_days, flash_start, flash_end,
        happy_hour_start, happy_hour_end, happy_hour_days, config,
        // Audience
        audience_type, audience_segment,
        // Schedule
        schedule_start, schedule_end,
        // Notification
        notif_template_type,
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
                 audience_type       = COALESCE($15, audience_type),
                 audience_segment    = COALESCE($16, audience_segment),
                 schedule_start      = COALESCE($17, schedule_start),
                 schedule_end        = COALESCE($18, schedule_end),
                 notif_template_type = COALESCE($19, notif_template_type),
                 updated_at          = NOW()
             WHERE id = $20
             RETURNING *`,
            [
                name ?? null, is_active ?? null, discount_type ?? null,
                discount_percent ?? null, discount_flat_paise ?? null,
                max_discount_paise ?? null, min_order_paise ?? null, winback_days ?? null,
                flash_start ?? null, flash_end ?? null,
                happy_hour_start ?? null, happy_hour_end ?? null,
                happy_hour_days ? JSON.stringify(happy_hour_days) : null,
                config ? JSON.stringify(config) : null,
                audience_type ?? null, audience_segment ?? null,
                schedule_start ?? null, schedule_end ?? null,
                notif_template_type ?? null,
                id
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
        await bustCampaignCache();

        // If campaign just turned active and has a notification template, send it
        if (is_active === true && rows[0].notif_template_type && !rows[0].notif_sent_at) {
            fireCampaignNotification(rows[0]).catch(() => {});
        }

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
