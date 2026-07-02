import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { emitToAll } from '../socket';

const router = Router();

// GET all collections (Admin)
router.get('/', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT c.*, z.name as zone_name 
            FROM collections c 
            LEFT JOIN zones z ON c.zone_id = z.id 
            ORDER BY c.sort_order ASC
        `);
        
        // Fetch items for each collection
        for (const col of rows) {
            const { rows: items } = await query(`
                SELECT mi.id, mi.name, mi.price_paise, mi.photo_url, ci.sort_order
                FROM collection_items ci
                JOIN menu_items mi ON ci.menu_item_id = mi.id
                WHERE ci.collection_id = $1
                ORDER BY ci.sort_order ASC
            `, [col.id]);
            col.items = items;
        }

        res.json({ collections: rows });
    } catch (err) {
        console.error('Fetch collections error:', err);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

// POST create a collection
router.post('/', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { title, subtitle, sort_order, is_active, zone_id, item_ids } = req.body;
        
        const { rows } = await query(
            'INSERT INTO collections (title, subtitle, sort_order, is_active, zone_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, subtitle || null, sort_order || 0, is_active ?? true, zone_id || null]
        );
        
        const collection = rows[0];

        if (item_ids && Array.isArray(item_ids)) {
            for (let i = 0; i < item_ids.length; i++) {
                await query(
                    'INSERT INTO collection_items (collection_id, menu_item_id, sort_order) VALUES ($1, $2, $3)',
                    [collection.id, item_ids[i], i]
                );
            }
        }
        
        emitToAll('menu_updated', { type: 'collection', action: 'create', collectionId: collection.id });
        res.json({ success: true, collection });
    } catch (err) {
        console.error('Create collection error:', err);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

// PUT update a collection
router.put('/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, sort_order, is_active, zone_id, item_ids } = req.body;
        
        await query(
            'UPDATE collections SET title = $1, subtitle = $2, sort_order = $3, is_active = $4, zone_id = $5, updated_at = NOW() WHERE id = $6',
            [title, subtitle || null, sort_order || 0, is_active ?? true, zone_id || null, id]
        );
        
        // Re-sync items if provided
        if (item_ids && Array.isArray(item_ids)) {
            await query('DELETE FROM collection_items WHERE collection_id = $1', [id]);
            for (let i = 0; i < item_ids.length; i++) {
                await query(
                    'INSERT INTO collection_items (collection_id, menu_item_id, sort_order) VALUES ($1, $2, $3)',
                    [id, item_ids[i], i]
                );
            }
        }
        
        emitToAll('menu_updated', { type: 'collection', action: 'update', collectionId: id });
        res.json({ success: true });
    } catch (err) {
        console.error('Update collection error:', err);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

// DELETE a collection
router.delete('/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM collections WHERE id = $1', [id]);
        emitToAll('menu_updated', { type: 'collection', action: 'delete', collectionId: id });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete collection error:', err);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

export default router;
