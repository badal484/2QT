-- Add customization capabilities to menu_items and order_items

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS customization_groups JSONB DEFAULT '[]'::jsonb;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Index for querying customizations if needed
CREATE INDEX IF NOT EXISTS idx_order_items_customizations ON order_items USING GIN (customizations);
