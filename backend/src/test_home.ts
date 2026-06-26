import { query } from './db';

async function test() {
    try {
        const zoneId = undefined;
        const bannerQuery = zoneId 
            ? 'SELECT id, image_url, destination_screen, destination_params, banner_type FROM promotional_banners WHERE is_active = true AND (zone_id IS NULL OR zone_id = $1) ORDER BY sort_order ASC'
            : 'SELECT id, image_url, destination_screen, destination_params, banner_type FROM promotional_banners WHERE is_active = true AND zone_id IS NULL ORDER BY sort_order ASC';
        const bannerParams = zoneId ? [zoneId] : [];
        console.log('bannerQuery:', bannerQuery, bannerParams);
        const { rows: banners } = await query(bannerQuery, bannerParams);
        console.log('banners:', banners.length);

        const collectionQuery = zoneId
            ? `SELECT c.id, c.title, c.subtitle, c.sort_order,
                COALESCE(json_agg(
                    json_build_object(
                        'id', m.id, 'name', m.name, 'description', m.description,
                        'price_paise', m.price_paise, 'is_veg', m.is_veg, 'is_egg', m.is_egg,
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
                        'price_paise', m.price_paise, 'is_veg', m.is_veg, 'is_egg', m.is_egg,
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
        console.log('collections:', collections.length);
    } catch (e: any) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}
test();
