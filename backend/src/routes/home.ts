import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Get the Home Feed Layout (SDUI)
router.get('/feed', async (req, res) => {
    try {
        const zoneId = req.query.zoneId as string;
        
        // We need: Search Block, Mini Banners, Strip Banners, Collections.
        
        // 1. Fetch Banners
        // We use IS NULL OR zone_id = $1 to handle global and zone-specific banners
        const bannerQuery = zoneId 
            ? 'SELECT id, image_url, NULL as destination_screen, NULL as destination_params, NULL as banner_type FROM promotional_banners WHERE is_active = true ORDER BY display_order ASC'
            : 'SELECT id, image_url, NULL as destination_screen, NULL as destination_params, NULL as banner_type FROM promotional_banners WHERE is_active = true ORDER BY display_order ASC';
        const bannerParams = zoneId ? [zoneId] : [];
        const { rows: banners } = await query(bannerQuery);

        const miniBanners = banners.filter(b => b.banner_type === 'MINI');
        const stripBanners = banners.filter(b => b.banner_type === 'STRIP');
        
        // 2. Fetch Active Collections with Items
        const collectionQuery = zoneId
            ? `SELECT c.id, c.title, c.subtitle, c.sort_order,
                COALESCE(json_agg(
                    json_build_object(
                        'id', m.id, 'name', m.name, 'description', m.description,
                        'price_paise', m.price_paise, 'is_veg', m.is_veg,
                        'photo_url', m.photo_url, 'kitchen_id', m.kitchen_id,
                        'available', m.available
                    ) ORDER BY ci.sort_order ASC
                ) FILTER (WHERE m.id IS NOT NULL), '[]') as items
             FROM collections c
             LEFT JOIN collection_items ci ON c.id = ci.collection_id
             LEFT JOIN menu_items m ON ci.menu_item_id = m.id
             WHERE c.is_active = true AND (c.zone_id IS NULL OR c.zone_id = $1)
             GROUP BY c.id
             ORDER BY c.sort_order ASC`
            : `SELECT c.id, c.title, c.subtitle, c.sort_order,
                COALESCE(json_agg(
                    json_build_object(
                        'id', m.id, 'name', m.name, 'description', m.description,
                        'price_paise', m.price_paise, 'is_veg', m.is_veg,
                        'photo_url', m.photo_url, 'kitchen_id', m.kitchen_id,
                        'available', m.available
                    ) ORDER BY ci.sort_order ASC
                ) FILTER (WHERE m.id IS NOT NULL), '[]') as items
             FROM collections c
             LEFT JOIN collection_items ci ON c.id = ci.collection_id
             LEFT JOIN menu_items m ON ci.menu_item_id = m.id
             WHERE c.is_active = true AND c.zone_id IS NULL
             GROUP BY c.id
             ORDER BY c.sort_order ASC`;
             
        const { rows: collections } = await query(collectionQuery, bannerParams);
        
        const feed = [];
        
        // Always add TOP_BAR (Search + Veg toggle)
        feed.push({ type: 'TOP_BAR' });
        
        // Add MINI_BANNERS if any
        if (miniBanners.length > 0) {
            feed.push({ type: 'MINI_BANNERS', data: miniBanners });
        }
        
        // Mix Collections and Strip Banners
        let stripIndex = 0;
        
        // Before collections, maybe put a STRIP_BANNER
        if (stripBanners[stripIndex]) {
            feed.push({ type: 'STRIP_BANNER', data: stripBanners[stripIndex] });
            stripIndex++;
        }

        collections.forEach((col) => {
            // Only add collection if it has items
            if (col.items && col.items.length > 0) {
                feed.push({
                    type: 'COLLECTION',
                    id: col.id,
                    title: col.title,
                    subtitle: col.subtitle,
                    data: col.items
                });
                
                // Add a strip banner after every collection if available
                if (stripBanners[stripIndex]) {
                    feed.push({ type: 'STRIP_BANNER', data: stripBanners[stripIndex] });
                    stripIndex++;
                }
            }
        });
        
        // If any strip banners left, put them at the end
        while(stripIndex < stripBanners.length) {
            feed.push({ type: 'STRIP_BANNER', data: stripBanners[stripIndex] });
            stripIndex++;
        }
        
        res.json({ feed });
    } catch (err) {
        console.error('Home feed error:', err);
        res.status(500).json({ error: 'Failed to fetch home feed' });
    }
});

export default router;
