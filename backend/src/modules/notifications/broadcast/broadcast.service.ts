import { query } from '../../../db';
import { redis } from '../../../redis';
import { CreateBroadcastInput } from './broadcast.dto';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';

export class BroadcastService {
    static async createCampaign(input: CreateBroadcastInput, adminUserId: string) {
        const { title, body, imageUrl, targetType, targetFilter = {} } = input;

        // 1. Create broadcast_campaigns record
        const { rows: campaignRows } = await query(
            `INSERT INTO broadcast_campaigns
               (title, body, image_url, target_type, target_filter, status, created_by, started_at)
             VALUES ($1, $2, $3, $4, $5, 'PROCESSING', $6, NOW())
             RETURNING *`,
            [title, body, imageUrl || null, targetType, JSON.stringify(targetFilter), adminUserId]
        );

        const campaign = campaignRows[0];

        // 2. Resolve recipient user IDs
        const recipientUserIds = await this.resolveRecipients(targetType, targetFilter);

        // 3. Update total_recipients count
        await query(
            `UPDATE broadcast_campaigns SET total_recipients = $1 WHERE id = $2`,
            [recipientUserIds.length, campaign.id]
        );

        if (recipientUserIds.length === 0) {
            await query(
                `UPDATE broadcast_campaigns SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
                [campaign.id]
            );
            return { ...campaign, total_recipients: 0, status: 'COMPLETED' };
        }

        // 4. Batch recipients into chunks of 50 and enqueue jobs
        const BATCH_SIZE = 50;
        const { notificationsQueue } = require('../../../jobs/queues');

        const jobs = [];
        for (let i = 0; i < recipientUserIds.length; i += BATCH_SIZE) {
            const batch = recipientUserIds.slice(i, i + BATCH_SIZE);
            jobs.push(
                notificationsQueue.add('broadcast_batch', {
                    campaignId: campaign.id,
                    userIdsBatch: batch,
                    title,
                    body,
                    imageUrl,
                    targetType,
                })
            );
        }

        Promise.all(jobs).catch((e) => console.warn('[BroadcastService] Queue enqueue warning:', e?.message));

        // 5. Non-blocking background dispatch (protected by Redis deduplication)
        setImmediate(() => {
            this.processCampaignBatchesInline(campaign.id, recipientUserIds, title, body, imageUrl, targetType, targetFilter);
        });

        return { ...campaign, total_recipients: recipientUserIds.length, status: 'PROCESSING' };
    }

    static processCampaignBatchesInline(
        campaignId: string,
        recipientUserIds: string[],
        title: string,
        body: string,
        imageUrl?: string,
        targetType?: string,
        targetFilter: Record<string, any> = {}
    ) {
        (async () => {
            const BATCH_SIZE = 50;

            // Fetch kitchen name if kitchenId is present for {{kitchen_name}} tag
            let kitchenName = '';
            if (targetFilter?.kitchenId) {
                try {
                    const kRes: any = await query('SELECT name FROM kitchens WHERE id = $1', [targetFilter.kitchenId]);
                    kitchenName = kRes?.rows?.[0]?.name || '';
                } catch {}
            }

            for (let i = 0; i < recipientUserIds.length; i += BATCH_SIZE) {
                const batch = recipientUserIds.slice(i, i + BATCH_SIZE);
                let sent = 0;
                let failed = 0;

                let userRows: any[] = [];
                try {
                    const userRes: any = await query(`SELECT id, name FROM users WHERE id = ANY($1)`, [batch]);
                    userRows = userRes?.rows || [];
                } catch {}
                const userMap = new Map(userRows.map(u => [u.id, u.name]));

                for (const userId of batch) {
                    const dedupeKey = `broadcast_dedup:${campaignId}:${userId}`;
                    const acquired = await redis.set(dedupeKey, '1', { EX: 86400, NX: true }).catch(() => null);
                    if (!acquired) continue; // Already claimed by another worker

                    try {
                        let appType: 'buyer' | 'rider' | 'kitchen' = 'buyer';
                        if (targetType === 'riders') appType = 'rider';
                        else if (targetType === 'kitchens' || targetType === 'kitchen_staff') appType = 'kitchen';

                        const rawName = (userMap.get(userId) || '').trim();
                        const firstName = rawName ? rawName.split(' ')[0] : (targetType === 'riders' ? 'Rider' : 'Foodie');
                        const fullName = rawName || firstName;

                        const recipientTitle = title
                            .replace(/\{\{\s*name\s*\}\}/gi, fullName)
                            .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
                            .replace(/\{\{\s*customer_name\s*\}\}/gi, fullName)
                            .replace(/\{\{\s*kitchen_name\s*\}\}/gi, kitchenName || 'our kitchen');

                        const recipientBody = body
                            .replace(/\{\{\s*name\s*\}\}/gi, fullName)
                            .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
                            .replace(/\{\{\s*customer_name\s*\}\}/gi, fullName)
                            .replace(/\{\{\s*kitchen_name\s*\}\}/gi, kitchenName || 'our kitchen');

                        const deepLinkData: Record<string, any> = {
                            campaignId,
                            title: recipientTitle,
                            body: recipientBody,
                        };

                        if (targetFilter?.kitchenId) {
                            deepLinkData.screen = 'KitchenMenu';
                            deepLinkData.kitchenId = targetFilter.kitchenId;
                            deepLinkData.url = `/menu?kitchen=${targetFilter.kitchenId}`;
                        }

                        await NotificationDispatcherService.dispatch({
                            userId,
                            type: 'broadcast_message',
                            title: recipientTitle,
                            body: recipientBody,
                            data: deepLinkData,
                            appType,
                            imageUrl: imageUrl || undefined,
                        });

                        sent++;
                    } catch {
                        failed++;
                    }
                }

                try {
                    await query(
                        `UPDATE broadcast_campaigns 
                         SET sent_count = sent_count + $1, failed_count = failed_count + $2
                         WHERE id = $3`,
                        [sent, failed, campaignId]
                    );
                } catch {}
            }

            try {
                await query(
                    `UPDATE broadcast_campaigns SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
                    [campaignId]
                );
            } catch {}
        })().catch(err => console.error('[BroadcastService] Async batch dispatch error:', err));
    }

    static async resolveRecipients(targetType: string, filter: Record<string, any>): Promise<string[]> {
        let sql = `SELECT id FROM users WHERE 1=1`;
        const params: any[] = [];

        if (targetType === 'buyers') {
            sql += ` AND LOWER(role::text) IN ('customer', 'buyer', 'admin', 'super_admin')`;
        } else if (targetType === 'riders') {
            sql += ` AND LOWER(role::text) IN ('rider', 'rider_captain')`;
            if (filter.zoneId) {
                params.push(filter.zoneId);
                sql += ` AND zone_id = $${params.length}`;
            }
        } else if (targetType === 'kitchens' || targetType === 'kitchen_staff') {
            sql += ` AND LOWER(role::text) IN ('chef', 'partner_kitchen', 'kitchen_manager', 'packer', 'kitchen')`;
            if (filter.kitchenId) {
                params.push(filter.kitchenId);
                sql += ` AND kitchen_id = $${params.length}`;
            }
        } else if (targetType === 'kitchen_customers') {
            if (filter.kitchenId) {
                params.push(filter.kitchenId);
                // Customers who either ordered from this kitchen OR have saved address in a zone served by this kitchen
                const { rows: customerRows } = await query(
                    `SELECT DISTINCT u.id FROM users u
                     WHERE (u.is_active = true OR u.is_active IS NULL)
                       AND LOWER(u.role::text) IN ('customer', 'buyer')
                       AND (
                         u.id IN (SELECT customer_id FROM orders WHERE kitchen_id = $1 AND customer_id IS NOT NULL)
                         OR
                         u.id IN (
                           SELECT a.customer_id FROM addresses a
                           JOIN kitchen_zones kz ON a.zone_id = kz.zone_id
                           WHERE kz.kitchen_id = $1
                         )
                         OR
                         u.zone_id IN (SELECT zone_id FROM kitchen_zones WHERE kitchen_id = $1)
                       )`,
                    params
                );
                return customerRows.map(r => r.id);
            } else {
                sql += ` AND LOWER(role::text) IN ('customer', 'buyer')`;
            }
        } else if (targetType === 'zone' && filter.zoneId) {
            params.push(filter.zoneId);
            sql += ` AND zone_id = $${params.length}`;
        } else if (targetType === 'users' && filter.userIds && Array.isArray(filter.userIds) && filter.userIds.length > 0) {
            params.push(filter.userIds);
            sql += ` AND id = ANY($${params.length})`;
        }

        const { rows } = await query(sql, params);
        return rows.map(r => r.id);
    }

    static async getCampaigns(limit = 50, offset = 0) {
        const { rows } = await query(
            `SELECT b.*, u.name AS created_by_name
             FROM broadcast_campaigns b
             LEFT JOIN users u ON b.created_by = u.id
             ORDER BY b.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return rows;
    }

    static async getCampaignById(id: string) {
        const { rows } = await query(
            `SELECT b.*, u.name AS created_by_name
             FROM broadcast_campaigns b
             LEFT JOIN users u ON b.created_by = u.id
             WHERE b.id = $1`,
            [id]
        );
        return rows[0] || null;
    }
}
