import { redis, keys, connectRedis } from './src/redis';
import { query } from './src/db';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    await connectRedis();
    const { rows } = await query("SELECT id, name FROM users WHERE role IN ('rider', 'rider_captain') AND is_online = true");
    
    // Central Delhi coordinates
    const baseLat = 28.6139;
    const baseLng = 77.2090;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const lat = baseLat + (Math.random() * 0.02 - 0.01);
        const lng = baseLng + (Math.random() * 0.02 - 0.01);
        await redis.set(keys.riderLocation(r.id), JSON.stringify({ lat, lng, updatedAt: new Date() }), { EX: 300 });
        console.log(`Set ${r.name} to ${lat}, ${lng}`);
    }
    process.exit(0);
}
run();
