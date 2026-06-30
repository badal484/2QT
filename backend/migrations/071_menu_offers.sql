-- Migration 071: Item and Category Level Offers

CREATE TABLE menu_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  
  -- Discount config
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_flat_paise INTEGER DEFAULT 0,
  max_discount_paise INTEGER,
  
  -- Target
  target_type TEXT NOT NULL CHECK (target_type IN ('category', 'item', 'kitchen', 'all')),
  target_id UUID, -- References category.id or menu_item.id or kitchen.id (null if 'all')
  
  -- Constraints & Scheduling
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'new_users', 'plus_subscribers')),
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_menu_offers_target ON menu_offers(target_type, target_id);
CREATE INDEX idx_menu_offers_active ON menu_offers(is_active);

-- Seed a test offer for Biryani Category (assuming Biryani exists)
-- We will seed this manually or in the code since category IDs are dynamic.
