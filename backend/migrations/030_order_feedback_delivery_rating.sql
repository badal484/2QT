-- Add delivery_rating to order_feedback and add unique constraint for ON CONFLICT
ALTER TABLE order_feedback
    ADD COLUMN IF NOT EXISTS delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5);

-- Add unique constraint on order_id so ON CONFLICT (order_id) works
ALTER TABLE order_feedback
    DROP CONSTRAINT IF EXISTS order_feedback_order_id_unique;

ALTER TABLE order_feedback
    ADD CONSTRAINT order_feedback_order_id_unique UNIQUE (order_id);
