import { Router } from 'express';
import multer from 'multer';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole } from '../middleware/auth';
import { emitToAll } from '../socket';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Geocoding proxy — mobile calls our backend, backend calls Nominatim
// This avoids emulator/device direct-internet issues with Nominatim
router.get('/geocode/search', async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.status(400).json({ error: 'MISSING_QUERY' });
    }
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=in`;
        
        if (apiKey) {
            url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${apiKey}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
            const data = await response.json();
            res.set('Cache-Control', 'public, max-age=60');
            // Format Google Places response to match expected output
            if (data.predictions) {
                const formatted = data.predictions.map((p: any) => ({
                    place_id: p.place_id,
                    display_name: p.description,
                }));
                return res.json(formatted);
            }
            return res.json([]);
        }

        const response = await fetch(url, { 
            headers: { 'User-Agent': '2QTFoodApp/1.0' },
            signal: AbortSignal.timeout(3000) 
        });
        const data = await response.json() as any[];
        res.set('Cache-Control', 'public, max-age=60');
        res.json(data);
    } catch (err) {
        console.error('[Geocode] Search failed:', err);
        res.status(502).json({ error: 'GEOCODE_UNAVAILABLE' });
    }
});

router.get('/geocode/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'INVALID_COORDS' });
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        let url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
        
        if (apiKey) {
            url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
            const data = await response.json();
            res.set('Cache-Control', 'public, max-age=300');
            // Extract the formatted_address from Google response
            if (data.results && data.results.length > 0) {
                return res.json({ display_name: data.results[0].formatted_address });
            }
            return res.json({ display_name: 'Current Location' });
        }

        const response = await fetch(url, { 
            headers: { 'User-Agent': '2QTFoodApp/1.0' },
            signal: AbortSignal.timeout(3000)
        });
        const data = await response.json();
        res.set('Cache-Control', 'public, max-age=300');
        res.json(data);
    } catch (err) {
        console.error('[Geocode] Reverse failed:', err);
        res.status(502).json({ error: 'GEOCODE_UNAVAILABLE' });
    }
});

router.get('/zones', async (req, res) => {
    const { rows } = await query('SELECT id, name, radius_km, kitchen_lat, kitchen_lng FROM zones WHERE is_active = true ORDER BY name');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ zones: rows });
});

router.get('/kitchen-metrics', async (req, res) => {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'MISSING_ZONE' });

    const { rows } = await query('SELECT * FROM kitchen_metrics WHERE zone_id = $1', [zoneId]);
    if (rows.length === 0) return res.json({ metrics: null });
    res.json({ metrics: rows[0] });
});

router.get('/', async (req, res) => {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'MISSING_ZONE' });

    const cacheKey = keys.menu(zoneId as string);

    // Redis with 500ms timeout — fail fast, never block menu load
    let cached = null;
    try {
        cached = await Promise.race([
            redis.get(cacheKey),
            new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 500)),
        ]);
    } catch { /* cache miss — continue to DB */ }

    if (cached) {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.json({ ...JSON.parse(cached as string), fromCache: true });
    }

    // Run all 3 DB queries in parallel — 3x faster on cache miss
    const [itemsResult, zoneResult, kitchenResult] = await Promise.all([
        query(
            `SELECT id, name, description, price_paise, photo_url, is_veg, is_egg, available,
                    category, kitchen_id, zone_id, sort_order, daily_limit,
                    today_sold_count, sold_out_reason, prep_time_minutes,
                    is_bestseller, is_new, tags
             FROM menu_items WHERE zone_id = $1 ORDER BY sort_order, name`,
            [zoneId]
        ),
        query(
            'SELECT name, opening_time, closing_time, surge_enabled, surge_fee_paise FROM zones WHERE id = $1',
            [zoneId]
        ),
        query(
            `SELECT k.name, k.is_paused, k.pause_reason
             FROM kitchens k
             JOIN kitchen_zones kz ON k.id = kz.kitchen_id
             WHERE kz.zone_id = $1 LIMIT 1`,
            [zoneId]
        ),
    ]);

    const response = {
        items: itemsResult.rows,
        zoneName: zoneResult.rows[0]?.name || null,
        kitchenName: kitchenResult.rows[0]?.name || null,
        kitchenPaused: kitchenResult.rows[0]?.is_paused || false,
        pauseReason: kitchenResult.rows[0]?.pause_reason || null,
        openingTime: zoneResult.rows[0]?.opening_time,
        closingTime: zoneResult.rows[0]?.closing_time,
    };

    // Cache async — don't await, response goes out immediately
    redis.set(cacheKey, JSON.stringify(response), { EX: 300 }).catch(() => {});

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ ...response, fromCache: false });
});

router.post('/validate-cart', async (req, res) => {
    const { items } = req.body;
    if (!items || !items.length) return res.json({ validItems: [], removedCount: 0, priceChanges: [] });

    // Single query for all cart items instead of N queries
    const ids = items.map((i: any) => i.menuItemId);
    const { rows } = await query(
        'SELECT id, price_paise, available FROM menu_items WHERE id = ANY($1::uuid[])',
        [ids]
    );
    const dbMap = new Map(rows.map((r: any) => [r.id, r]));

    const validItems = [];
    const priceChanges = [];
    let removedCount = 0;

    for (const item of items) {
        const db = dbMap.get(item.menuItemId);
        if (!db || !db.available) { removedCount++; continue; }
        if (db.price_paise !== item.pricePaise) {
            priceChanges.push({ menuItemId: item.menuItemId, oldPrice: item.pricePaise, newPrice: db.price_paise });
            item.pricePaise = db.price_paise;
        }
        validItems.push(item);
    }

    res.json({ validItems, removedCount, priceChanges });
});

router.get('/search', async (req, res) => {
    const { q, zoneId } = req.query;
    if (!q || !zoneId) return res.status(400).json({ error: 'INVALID_QUERY' });

    const { rows } = await query(
        `SELECT *, ts_rank(search_vector, websearch_to_tsquery('english', $1)) as rank
         FROM menu_items
         WHERE zone_id = $2 AND search_vector @@ websearch_to_tsquery('english', $1)
         ORDER BY rank DESC LIMIT 20`,
        [q, zoneId]
    );

    res.json({ results: rows });
});

router.get('/zones/check', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'INVALID_LOCATION' });

    try {
        // LEAST/GREATEST clamps acos input to [-1,1] — prevents NaN crash on floating-point edge cases
        const { rows } = await query(`
            SELECT id, name, radius_km, polygon_points,
            (6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians($1)) * cos(radians(kitchen_lat)) * cos(radians(kitchen_lng) - radians($2))
                + sin(radians($1)) * sin(radians(kitchen_lat))
            )))) AS distance
            FROM zones
            WHERE is_active = true
            ORDER BY distance ASC
        `, [lat, lng]);

        const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
            let x = point.lng, y = point.lat, inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].lng, yi = polygon[i].lat;
                const xj = polygon[j].lng, yj = polygon[j].lat;
                if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
                    inside = !inside;
            }
            return inside;
        };

        for (const zone of rows) {
            const pts = zone.polygon_points;
            const hasPolygon = pts && Array.isArray(pts) && pts.length > 2;
            if (hasPolygon) {
                if (isPointInPolygon({ lat, lng }, pts))
                    return res.json({ serviceable: true, zone });
            } else {
                if (zone.distance <= zone.radius_km)
                    return res.json({ serviceable: true, zone });
            }
        }

        res.json({ serviceable: false, zone: null });
    } catch (err: any) {
        console.error('[ZONES_CHECK_ERROR]', err.message);
        res.status(500).json({ error: 'CHECK_FAILED', message: err.message });
    }
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
    emitToAll('menu_updated', { zoneId: rows[0].zone_id });

    res.json({ item: rows[0] });
});

export default router;
