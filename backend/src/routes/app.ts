import { Router } from 'express';
import { query } from '../db';
import axios from 'axios';

const router = Router();

router.get('/version', async (req, res) => {
    const { rows } = await query('SELECT key, value FROM app_settings');
    const settings: any = {};
    rows.forEach(r => settings[r.key] = r.value);

    res.json({
        latestVersion: settings.latest_app_version || '1.0.0',
        minRequiredVersion: settings.min_app_version || '1.0.0',
        forceUpdate: settings.force_update === 'true',
        maintenanceMode: settings.maintenance_mode === 'true',
        updateUrl: 'https://2qt.in/download'
    });
});

router.get('/config/maps-key', (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// Reverse geocode proxy — avoids client-side API key requirements and rate limits
router.get('/geocode/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Invalid coordinates' });

    try {
        // zoom=18 gives building-level detail; namedetails=1 returns place names
        const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon: lng, format: 'json', addressdetails: 1, namedetails: 1, zoom: 18 },
            headers: { 'User-Agent': '2QT-FoodDelivery/1.0 (support@2qt.in)', 'Accept-Language': 'en' },
            timeout: 8000,
        });

        if (!data || data.error) return res.json({ name: null, address: null });

        const a = data.address || {};
        const nd = data.namedetails || {};

        // Best short label: official name → road → locality → admin area
        const name =
            nd['name:en'] || nd.name || data.name ||
            a.road || a.pedestrian || a.footway || a.path ||
            a.suburb || a.neighbourhood || a.quarter || a.hamlet ||
            a.village || a.town || a.city_district || a.city ||
            a.county || a.state_district || a.state || null;

        // Full address: road + locality + district + state (deduplicated)
        const parts = [
            a.road || a.pedestrian,
            a.suburb || a.neighbourhood || a.hamlet || a.village || a.town,
            a.county || a.state_district,
            a.state,
        ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

        const address = parts.length >= 2
            ? parts.join(', ')
            : (data.display_name || '')
                .split(', ')
                .filter((p: string) => p !== 'India' && !/^\d{4,6}$/.test(p))
                .join(', ');

        return res.json({ name, address: address || name });
    } catch (err: any) {
        console.error('[GEOCODE]', err.message);
        return res.status(502).json({ error: 'Geocoding failed' });
    }
});

export default router;
