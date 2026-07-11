import { redis } from '../redis';
import { query } from '../db';

const CACHE_TTL_SEC = 300; // 5 minutes

export async function getAppSetting(key: string, fallback: string): Promise<string> {
    const cacheKey = `2qt:setting:${key}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) return cached;
    } catch {}

    try {
        const { rows } = await query('SELECT value FROM app_settings WHERE key = $1', [key]);
        const value = rows[0]?.value ?? fallback;
        await redis.set(cacheKey, value, { EX: CACHE_TTL_SEC }).catch(() => {});
        return value;
    } catch {
        return fallback;
    }
}

export async function getAppSettingInt(key: string, fallback: number): Promise<number> {
    const raw = await getAppSetting(key, String(fallback));
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? fallback : parsed;
}

export function bustSettingCache(key: string): void {
    redis.del(`2qt:setting:${key}`).catch(() => {});
}
