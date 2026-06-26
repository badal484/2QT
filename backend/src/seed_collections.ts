import { query } from './db';

async function seed() {
    try {
        console.log('Seeding dummy collection...');
        const c = await query("INSERT INTO collections (title, subtitle, sort_order) VALUES ('Wholesome Meals', 'Trending near you', 1) RETURNING id");
        const colId = c.rows[0].id;
        const items = await query('SELECT id FROM menu_items LIMIT 5');
        for (let i = 0; i < items.rows.length; i++) {
            await query('INSERT INTO collection_items (collection_id, menu_item_id, sort_order) VALUES ($1, $2, $3)', [colId, items.rows[i].id, i]);
        }
        console.log('Dummy collection created successfully');
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

seed();
