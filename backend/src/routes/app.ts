import { Router } from 'express';
import { query } from '../db';

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

export default router;
