import crypto from 'crypto';
import { query } from '../../../db';

export type AppType = 'buyer' | 'rider' | 'kitchen';
export type Platform = 'android' | 'ios' | 'web';

export interface RegisterDeviceTokenInput {
    userId: string;
    deviceId: string;
    appType: AppType;
    platform: Platform;
    fcmToken: string;
}

export class DeviceTokenService {
    private static hashToken(fcmToken: string): string {
        return crypto.createHash('sha256').update(fcmToken).digest('hex');
    }

    static async registerToken(input: RegisterDeviceTokenInput): Promise<any> {
        const { userId, deviceId, appType, platform, fcmToken } = input;
        const tokenHash = this.hashToken(fcmToken);

        try {
            // Deactivate any existing tokens with the same fcm_token for other device_ids/users
            await query(
                `UPDATE device_tokens 
                 SET is_active = FALSE, updated_at = NOW() 
                 WHERE (fcm_token = $1 OR token_hash = $2) AND (user_id != $3 OR device_id != $4)`,
                [fcmToken, tokenHash, userId, deviceId]
            ).catch(() => {});

            const { rows } = await query(
                `INSERT INTO device_tokens 
                   (user_id, device_id, app_type, platform, fcm_token, token_hash, is_active, last_used_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
                 ON CONFLICT (user_id, device_id, app_type) DO UPDATE SET
                   fcm_token = EXCLUDED.fcm_token,
                   token_hash = EXCLUDED.token_hash,
                   platform = EXCLUDED.platform,
                   is_active = TRUE,
                   last_used_at = NOW(),
                   updated_at = NOW()
                 RETURNING *`,
                [userId, deviceId, appType, platform, fcmToken, tokenHash]
            );

            return rows[0];
        } catch (e: any) {
            console.error('[DeviceTokenService] registerToken error:', e.message);
            throw e;
        }
    }

    static async deactivateDeviceToken(userId: string, deviceId: string, appType?: AppType): Promise<void> {
        try {
            if (appType) {
                await query(
                    `UPDATE device_tokens 
                     SET is_active = FALSE, updated_at = NOW() 
                     WHERE user_id = $1 AND device_id = $2 AND app_type = $3`,
                    [userId, deviceId, appType]
                );
            } else {
                await query(
                    `UPDATE device_tokens 
                     SET is_active = FALSE, updated_at = NOW() 
                     WHERE user_id = $1 AND device_id = $2`,
                    [userId, deviceId]
                );
            }
        } catch (e: any) {
            console.error('[DeviceTokenService] deactivateDeviceToken error:', e.message);
        }
    }

    static async markTokenInvalid(fcmToken: string): Promise<void> {
        try {
            const tokenHash = this.hashToken(fcmToken);
            await query(
                `UPDATE device_tokens 
                 SET is_active = FALSE, updated_at = NOW() 
                 WHERE token_hash = $1 OR fcm_token = $2`,
                [tokenHash, fcmToken]
            );
        } catch (e: any) {
            console.error('[DeviceTokenService] markTokenInvalid error:', e.message);
        }
    }

    static async getActiveTokensForUser(userId: string, appType?: AppType): Promise<string[]> {
        try {
            let sql = `SELECT DISTINCT fcm_token FROM device_tokens WHERE user_id = $1 AND is_active = TRUE`;
            const params: any[] = [userId];

            if (appType) {
                sql += ` AND app_type = $2`;
                params.push(appType);
            }

            const res = await query(sql, params);
            if (!res || !res.rows) return [];
            return res.rows.map((r: any) => r.fcm_token);
        } catch {
            return [];
        }
    }

    static async getActiveTokensForUsers(userIds: string[], appType?: AppType): Promise<{ userId: string; fcmToken: string; appType: string }[]> {
        if (!userIds.length) return [];

        try {
            let sql = `SELECT DISTINCT user_id, fcm_token, app_type FROM device_tokens WHERE user_id = ANY($1) AND is_active = TRUE`;
            const params: any[] = [userIds];

            if (appType) {
                sql += ` AND app_type = $2`;
                params.push(appType);
            }

            const res = await query(sql, params);
            if (!res || !res.rows) return [];
            return res.rows.map((r: any) => ({
                userId: r.user_id,
                fcmToken: r.fcm_token,
                appType: r.app_type,
            }));
        } catch {
            return [];
        }
    }
}
