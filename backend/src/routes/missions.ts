import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';

const router = Router();

// ─── ADMIN: list all templates ───────────────────────────────────────────────
router.get('/templates', authenticate, requireRole('super_admin'), async (_req, res) => {
    const { rows } = await query(`
        SELECT mt.*,
               COALESCE(z.name, 'All Zones') AS zone_name,
               (SELECT COUNT(*)::int FROM rider_missions rm
                WHERE rm.template_id = mt.id AND rm.date = CURRENT_DATE) AS today_riders,
               (SELECT COUNT(*)::int FROM rider_missions rm
                WHERE rm.template_id = mt.id AND rm.date = CURRENT_DATE
                  AND rm.status = 'completed') AS today_completed
        FROM mission_templates mt
        LEFT JOIN zones z ON mt.zone_id = z.id
        ORDER BY mt.sort_order, mt.created_at
    `);
    res.json({ templates: rows });
});

// ─── ADMIN: create template ──────────────────────────────────────────────────
router.post('/templates', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
    const { title, description, icon, color, type, tiers, windowType, zoneId, sortOrder } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    if (!type) return res.status(400).json({ error: 'type required' });
    if (!Array.isArray(tiers) || tiers.length === 0) return res.status(400).json({ error: 'at least one tier required' });

    const { rows } = await query(`
        INSERT INTO mission_templates (title, description, icon, color, type, tiers, window_type, zone_id, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
        title.trim(),
        description?.trim() || '',
        icon || 'zap',
        color || '#FC4603',
        type,
        JSON.stringify(tiers),
        windowType || 'daily',
        zoneId || null,
        sortOrder ?? 0,
    ]);
    res.status(201).json({ template: rows[0] });
});

// ─── ADMIN: update template ──────────────────────────────────────────────────
router.patch('/templates/:id', authenticate, requireRole('super_admin'), async (req, res) => {
    const { id } = req.params;
    const { title, description, icon, color, type, tiers, windowType, zoneId, sortOrder } = req.body;

    const { rows } = await query(`
        UPDATE mission_templates SET
            title        = COALESCE($2, title),
            description  = COALESCE($3, description),
            icon         = COALESCE($4, icon),
            color        = COALESCE($5, color),
            type         = COALESCE($6, type),
            tiers        = COALESCE($7::jsonb, tiers),
            window_type  = COALESCE($8, window_type),
            zone_id      = $9,
            sort_order   = COALESCE($10, sort_order),
            updated_at   = NOW()
        WHERE id = $1 RETURNING *
    `, [id, title, description, icon, color, type,
        tiers ? JSON.stringify(tiers) : null,
        windowType, zoneId ?? null, sortOrder]);

    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ template: rows[0] });
});

// ─── ADMIN: toggle active ────────────────────────────────────────────────────
router.patch('/templates/:id/toggle', authenticate, requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
        UPDATE mission_templates SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1 RETURNING id, is_active, title
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ id: rows[0].id, isActive: rows[0].is_active, title: rows[0].title });
});

// ─── ADMIN: delete template ──────────────────────────────────────────────────
router.delete('/templates/:id', authenticate, requireRole('super_admin'), async (req, res) => {
    await query('DELETE FROM mission_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// ─── ADMIN: rider mission stats for a template ───────────────────────────────
router.get('/templates/:id/stats', authenticate, requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
        SELECT u.name, u.phone, rm.progress, rm.tier_reached, rm.bonus_awarded_paise, rm.status, rm.date
        FROM rider_missions rm
        JOIN users u ON u.id = rm.rider_id
        WHERE rm.template_id = $1
        ORDER BY rm.date DESC, rm.progress DESC
        LIMIT 100
    `, [req.params.id]);
    res.json({ stats: rows });
});

// ─── RIDER: fetch today's + this week's missions ─────────────────────────────
router.get('/rider', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;

    const [todayRes, weekRes, streakRes] = await Promise.all([
        query(`SELECT deliveries_count, total_paise FROM rider_daily_earnings
               WHERE rider_id = $1 AND date = CURRENT_DATE`, [riderId]),
        query(`SELECT COALESCE(SUM(deliveries_count),0)::int AS w_del,
                      COALESCE(SUM(total_paise),0)::int      AS w_paise
               FROM rider_daily_earnings
               WHERE rider_id = $1 AND date >= date_trunc('week', CURRENT_DATE)`, [riderId]),
        query(`SELECT current_streak_days, longest_streak_days FROM users WHERE id = $1`, [riderId]),
    ]);

    const todayDeliveries = parseInt(todayRes.rows[0]?.deliveries_count || '0');
    const todayPaise      = parseInt(todayRes.rows[0]?.total_paise    || '0');
    const weekDeliveries  = parseInt(weekRes.rows[0]?.w_del  || '0');
    const weekPaise       = parseInt(weekRes.rows[0]?.w_paise || '0');
    const streak          = streakRes.rows[0] || { current_streak_days: 0, longest_streak_days: 0 };

    // Lazy-assign active daily missions not yet created for today
    await query(`
        INSERT INTO rider_missions (rider_id, template_id, date)
        SELECT $1, mt.id, CURRENT_DATE
        FROM mission_templates mt
        WHERE mt.is_active = true AND mt.window_type = 'daily'
          AND (mt.zone_id IS NULL)
        ON CONFLICT (rider_id, template_id, date) DO NOTHING
    `, [riderId]);

    // Lazy-assign active weekly missions (date = Monday of current week)
    await query(`
        INSERT INTO rider_missions (rider_id, template_id, date)
        SELECT $1, mt.id, date_trunc('week', CURRENT_DATE)::date
        FROM mission_templates mt
        WHERE mt.is_active = true AND mt.window_type = 'weekly'
          AND (mt.zone_id IS NULL)
        ON CONFLICT (rider_id, template_id, date) DO NOTHING
    `, [riderId]);

    // Fetch all mission rows with template info
    const { rows: missions } = await query(`
        SELECT rm.id, rm.template_id, rm.date, rm.progress, rm.tier_reached,
               rm.bonus_awarded_paise, rm.status, rm.completed_at,
               mt.title, mt.description, mt.icon, mt.color, mt.type, mt.tiers, mt.window_type
        FROM rider_missions rm
        JOIN mission_templates mt ON mt.id = rm.template_id
        WHERE rm.rider_id = $1
          AND (
            (mt.window_type = 'daily'  AND rm.date = CURRENT_DATE) OR
            (mt.window_type = 'weekly' AND rm.date = date_trunc('week', CURRENT_DATE)::date)
          )
        ORDER BY mt.sort_order, mt.created_at
    `, [riderId]);

    // Compute live progress + check for newly reached tiers
    const result = [];
    for (const m of missions) {
        const liveProgress = m.type === 'delivery_count'
            ? (m.window_type === 'daily' ? todayDeliveries : weekDeliveries)
            : (m.window_type === 'daily' ? todayPaise      : weekPaise);

        const tiers: Array<{ target: number; reward_paise: number; label: string }> = m.tiers || [];

        // Determine which tiers are now unlocked
        let newTierReached = 0;
        let newTotalBonus  = 0;
        for (let i = 0; i < tiers.length; i++) {
            if (liveProgress >= tiers[i].target) {
                newTierReached = i + 1;
                newTotalBonus += tiers[i].reward_paise;
            }
        }

        // Award any newly unlocked tiers
        if (newTierReached > m.tier_reached) {
            const bonusToGive = newTotalBonus - m.bonus_awarded_paise;
            const allDone     = newTierReached === tiers.length;

            await query(`
                UPDATE rider_missions SET
                    progress            = $2,
                    tier_reached        = $3,
                    bonus_awarded_paise = $4,
                    status              = $5,
                    completed_at        = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END,
                    updated_at          = NOW()
                WHERE id = $1
            `, [m.id, liveProgress, newTierReached, newTotalBonus,
                allDone ? 'completed' : 'active']);

            if (bonusToGive > 0) {
                await query(`
                    INSERT INTO rider_daily_earnings
                        (rider_id, date, deliveries_count, base_earnings_paise, bonus_earnings_paise, total_paise)
                    VALUES ($1, CURRENT_DATE, 0, 0, $2, $2)
                    ON CONFLICT (rider_id, date) DO UPDATE SET
                        bonus_earnings_paise = COALESCE(rider_daily_earnings.bonus_earnings_paise,0) + $2,
                        total_paise          = rider_daily_earnings.total_paise + $2
                `, [riderId, bonusToGive]);

                // Push notification on tier unlock
                const tierLabel = tiers[newTierReached - 1]?.label || '';
                NotificationService.send('broadcast_message', {
                    userId: riderId,
                    title: `🎯 Mission Unlocked — ${tierLabel}`,
                    body: `You completed the "${m.title}" ${tierLabel} tier! ₹${(bonusToGive / 100).toFixed(0)} bonus added.`,
                    screen: 'Missions',
                }).catch(() => {});
            }

            m.tier_reached        = newTierReached;
            m.bonus_awarded_paise = newTotalBonus;
            m.status              = allDone ? 'completed' : 'active';
        } else if (liveProgress !== m.progress) {
            // Just update progress, no new tier
            await query(`UPDATE rider_missions SET progress = $2, updated_at = NOW() WHERE id = $1`,
                [m.id, liveProgress]);
        }

        result.push({
            id:                 m.id,
            templateId:         m.template_id,
            title:              m.title,
            description:        m.description,
            icon:               m.icon,
            color:              m.color,
            type:               m.type,
            tiers,
            windowType:         m.window_type,
            progress:           liveProgress,
            tierReached:        m.tier_reached,
            bonusAwardedPaise:  m.bonus_awarded_paise,
            status:             m.status,
            completedAt:        m.completed_at,
        });
    }

    res.json({
        missions: result,
        todayDeliveries,
        todayEarningsPaise: todayPaise,
        weekDeliveries,
        weekEarningsPaise:  weekPaise,
        currentStreak:      streak.current_streak_days  || 0,
        longestStreak:      streak.longest_streak_days  || 0,
    });
});

export default router;
