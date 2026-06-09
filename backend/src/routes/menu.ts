import { Router } from 'express';
import multer from 'multer';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole } from '../middleware/auth';
import { emitToRiders } from '../socket';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/zones', async (req, res) => {
    const { rows } = await query('SELECT id, name, radius_km, kitchen_lat, kitchen_lng FROM zones WHERE is_active = true ORDER BY name');
    res.json({ zones: rows });
});

router.get('/', async (req, res) => {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'MISSING_ZONE' });

    const cacheKey = keys.menu(zoneId as string);
    
    // Add safety timeout for Redis
    let cached = null;
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 2000));
        cached = await Promise.race([redis.get(cacheKey), timeoutPromise]);
    } catch (e) {
        console.warn('--- REDIS: CACHE FETCH FAILED OR TIMED OUT', e);
    }
    
    if (cached) {
        return res.json({ ...JSON.parse(cached as string), fromCache: true });
    }

    const { rows: items } = await query(
        'SELECT * FROM menu_items WHERE zone_id = $1 ORDER BY sort_order, name',
        [zoneId]
    );

    const { rows: zoneInfo } = await query(
        'SELECT opening_time, closing_time, surge_enabled, surge_fee_paise FROM zones WHERE id = $1',
        [zoneId]
    );

    const { rows: kitchenInfo } = await query(
        `SELECT k.is_paused, k.pause_reason 
         FROM kitchens k 
         JOIN kitchen_zones kz ON k.id = kz.kitchen_id 
         WHERE kz.zone_id = $1 LIMIT 1`,
        [zoneId]
    );

    const response = {
        items,
        kitchenPaused: kitchenInfo[0]?.is_paused || false,
        pauseReason: kitchenInfo[0]?.pause_reason || null,
        openingTime: zoneInfo[0]?.opening_time,
        closingTime: zoneInfo[0]?.closing_time,
    };

    await redis.set(cacheKey, JSON.stringify(response), { EX: 300 }); // 5 mins

    res.json({ ...response, fromCache: false });
});

router.get('/search', async (req, res) => {
    const { q, zoneId } = req.query;
    if (!q || !zoneId) return res.status(400).json({ error: 'INVALID_QUERY' });

    const { rows } = await query(
        `SELECT *, ts_rank(search_vector, q) as rank 
         FROM menu_items, to_tsquery('english', $1 || ':*') as q 
         WHERE zone_id = $2 AND search_vector @@ q 
         ORDER BY rank DESC LIMIT 20`,
        [q, zoneId]
    );

    res.json({ results: rows });
});

router.get('/zones/check', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'INVALID_LOCATION' });

    const { rows } = await query(`
        SELECT id, name, radius_km, polygon_points,
        (6371 * acos(cos(radians($1)) * cos(radians(kitchen_lat)) * cos(radians(kitchen_lng) - radians($2)) + sin(radians($1)) * sin(radians(kitchen_lat)))) AS distance
        FROM zones
        WHERE is_active = true
        ORDER BY distance ASC
    `, [lat, lng]);

    // Ray-Casting Algorithm for Point in Polygon
    const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
        let x = point.lng, y = point.lat;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            let xi = polygon[i].lng, yi = polygon[i].lat;
            let xj = polygon[j].lng, yj = polygon[j].lat;
            
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    for (const zone of rows) {
        if (zone.polygon_points && Array.isArray(zone.polygon_points) && zone.polygon_points.length > 2) {
            // Check polygon
            if (isPointInPolygon({ lat, lng }, zone.polygon_points)) {
                return res.json({ serviceable: true, zone });
            }
        } else {
            // Fallback to radius
            if (zone.distance <= zone.radius_km) {
                return res.json({ serviceable: true, zone });
            }
        }
    }

    res.json({ serviceable: false, zone: null });
});

router.patch('/items/:id/toggle', authenticate, requireRole('chef', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    
    const { rows } = await query(
        'UPDATE menu_items SET available = NOT available, sold_out_reason = CASE WHEN available = false THEN \'manual\' ELSE NULL END WHERE id = $1 RETURNING *',
        [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    // Clear cache for the zone and notify riders/kitchen of menu change
    await redis.del(keys.menu(rows[0].zone_id));
    emitToRiders('menu_updated', { zoneId: rows[0].zone_id }, rows[0].zone_id);

    res.json({ item: rows[0] });
});

export default router;
