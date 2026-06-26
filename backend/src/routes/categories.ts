import express from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// ─── Public: GET active categories for a zone ───────────────────────────────
router.get('/', async (req, res) => {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'zoneId is required' });
    try {
        const { rows } = await query(
            `SELECT id, name, slug, image_url, banner_url, sort_order
             FROM menu_categories
             WHERE zone_id = $1 AND is_active = TRUE
             ORDER BY sort_order ASC, created_at ASC`,
            [zoneId]
        );
        res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
        res.json({ categories: rows });
    } catch (err: any) {
        console.error('[CATEGORIES_GET]', err.message);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ─── Admin: GET all categories for a zone (incl. inactive) ──────────────────
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { zoneId } = req.query;
    if (!zoneId) return res.status(400).json({ error: 'zoneId is required' });
    try {
        const { rows } = await query(
            `SELECT * FROM menu_categories
             WHERE zone_id = $1
             ORDER BY sort_order ASC, created_at ASC`,
            [zoneId]
        );
        res.json({ categories: rows });
    } catch (err: any) {
        console.error('[CATEGORIES_ADMIN_GET]', err.message);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ─── Admin: GET all distinct category slugs from menu items for a zone ───────
// Used by admin UI to populate a slug picker (prevent typos)
router.get('/admin/slugs', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { zoneId } = req.query;
    try {
        let rows;
        if (zoneId) {
            // Items belonging to kitchens in this zone
            const result = await query(
                `SELECT DISTINCT mi.category AS slug
                 FROM menu_items mi
                 JOIN kitchen_zones kz ON kz.kitchen_id = mi.kitchen_id
                 WHERE kz.zone_id = $1
                   AND mi.category IS NOT NULL AND mi.category != ''
                 ORDER BY slug`,
                [zoneId]
            );
            rows = result.rows;
        } else {
            const result = await query(
                `SELECT DISTINCT category AS slug FROM menu_items
                 WHERE category IS NOT NULL AND category != ''
                 ORDER BY slug`
            );
            rows = result.rows;
        }
        res.json({ slugs: rows.map((r: any) => r.slug) });
    } catch (err: any) {
        console.error('[CATEGORIES_SLUGS]', err.message);
        res.status(500).json({ error: 'Failed to fetch category slugs' });
    }
});

// ─── Admin: CREATE category ──────────────────────────────────────────────────
router.post('/admin', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { zone_id, name, slug, image_url, banner_url, sort_order, is_active } = req.body;
    if (!zone_id || !name || !slug) {
        return res.status(400).json({ error: 'zone_id, name and slug are required' });
    }
    try {
        const { rows } = await query(
            `INSERT INTO menu_categories (zone_id, name, slug, image_url, banner_url, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [zone_id, name, slug.trim(), image_url || '', banner_url || '', sort_order ?? 0, is_active ?? true]
        );
        res.status(201).json({ category: rows[0] });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A category with this slug already exists for this zone' });
        }
        console.error('[CATEGORIES_CREATE]', err.message);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// ─── Admin: UPDATE category ──────────────────────────────────────────────────
router.patch('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, slug, image_url, banner_url, sort_order, is_active } = req.body;
    try {
        const { rows } = await query(
            `UPDATE menu_categories
             SET name       = COALESCE($1, name),
                 slug       = COALESCE($2, slug),
                 image_url  = COALESCE($3, image_url),
                 banner_url = COALESCE($4, banner_url),
                 sort_order = COALESCE($5, sort_order),
                 is_active  = COALESCE($6, is_active),
                 updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [name, slug, image_url, banner_url, sort_order, is_active, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ category: rows[0] });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Slug conflict: another category in this zone already uses this slug' });
        }
        console.error('[CATEGORIES_UPDATE]', err.message);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// ─── Admin: REORDER (bulk update sort_order) ─────────────────────────────────
// Body: { orders: [{ id: uuid, sort_order: number }, ...] }
router.patch('/admin/reorder', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders must be an array' });
    try {
        await Promise.all(
            orders.map(({ id, sort_order }: { id: string; sort_order: number }) =>
                query('UPDATE menu_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2', [sort_order, id])
            )
        );
        res.json({ message: 'Reordered successfully' });
    } catch (err: any) {
        console.error('[CATEGORIES_REORDER]', err.message);
        res.status(500).json({ error: 'Failed to reorder categories' });
    }
});

// ─── Admin: DELETE category ──────────────────────────────────────────────────
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM menu_categories WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err: any) {
        console.error('[CATEGORIES_DELETE]', err.message);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
