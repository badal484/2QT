// Upstash's dashboard shows a `redis-cli --tls -u redis://...` snippet right next to the
// bare URL, and it's an easy copy-paste mistake to grab the whole CLI command instead of
// just the URL. When that lands in REDIS_URL, a raw `new IORedis(url)` treats the garbled
// string as a literal path and fails with ENOENT on every connection attempt. This extracts
// just the `redis://` or `rediss://` portion regardless of what's pasted around it, so every
// Redis client in the app (node-redis and ioredis alike) is immune to that mistake.
export function getCleanRedisUrl(): string {
    let url = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
    const match = url.match(/(rediss?:\/\/[^\s"']+)/);
    if (match) url = match[1];
    return url;
}

export function isRedisTls(url: string): boolean {
    return (process.env.REDIS_URL || '').includes('--tls') || url.startsWith('rediss://') || url.includes('upstash.io');
}
