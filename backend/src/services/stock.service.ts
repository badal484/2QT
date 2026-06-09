import { query, withTransaction } from '../db';
import { notificationsQueue } from '../jobs/queues';

export const deductStockForOrder = async (orderId: string) => {
    await withTransaction(async (client) => {
        // 1. Get all items in the order
        const { rows: items } = await client.query(
            "SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1",
            [orderId]
        );

        for (const item of items) {
            // 2. Get ingredients for each menu item
            const { rows: recipe } = await client.query(`
                SELECT ri.ingredient_id, ri.quantity as amount, i.name, i.current_stock, i.reorder_threshold
                FROM recipe_ingredients ri
                JOIN recipes r ON ri.recipe_id = r.id
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE r.menu_item_id = $1 AND r.is_active = true
            `, [item.menu_item_id]);

            for (const ing of recipe) {
                const totalDeduction = ing.amount * item.quantity;
                
                // 3. Update stock
                const { rows: updated } = await client.query(`
                    UPDATE ingredients 
                    SET current_stock = current_stock - $1,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING current_stock, reorder_threshold, name
                `, [totalDeduction, ing.ingredient_id]);

                const status = updated[0];
                
                // 4. Alert if low stock
                if (status.current_stock <= status.reorder_threshold) {
                    await notificationsQueue.add('low_stock_alert', {
                        ingredientName: status.name,
                        currentStock: status.current_stock
                    });
                }
            }
        }
    });
};

export const checkAllStockThresholds = async () => {
    const { rows } = await query(`
        SELECT name, current_stock_grams, reorder_threshold_grams 
        FROM ingredients 
        WHERE current_stock_grams <= reorder_threshold_grams
    `);

    for (const ing of rows) {
        await notificationsQueue.add('low_stock_alert', {
            ingredientName: ing.name,
            currentStock: ing.current_stock_grams
        });
    }
};
