-- Migration 006: Menu and Ingredients
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- grams, ml, pieces
    current_stock DECIMAL NOT NULL DEFAULT 0,
    reorder_threshold DECIMAL NOT NULL DEFAULT 0,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_ingredients_updated_at ON ingredients;
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES zones(id),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    name TEXT NOT NULL,
    description TEXT,
    price_paise INTEGER NOT NULL,
    cost_price_paise INTEGER NOT NULL,
    photo_url TEXT,
    finished_dish_photo_url TEXT,
    category TEXT NOT NULL,
    station TEXT DEFAULT 'hot_section',
    available BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 50,
    today_sold_count INTEGER DEFAULT 0,
    sold_out_reason TEXT,
    is_veg BOOLEAN DEFAULT true,
    is_vegan BOOLEAN DEFAULT false,
    spice_level INTEGER DEFAULT 1,
    allergens TEXT[] DEFAULT '{}',
    prep_time_minutes INTEGER DEFAULT 15,
    sort_order INTEGER DEFAULT 0,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Search vector trigger
CREATE OR REPLACE FUNCTION menu_items_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', NEW.name || ' ' || coalesce(NEW.description, '') || ' ' || NEW.category);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_menu_items_search ON menu_items;
CREATE TRIGGER trigger_menu_items_search
BEFORE INSERT OR UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION menu_items_search_trigger();

CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items USING GIN(search_vector);

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity DECIMAL NOT NULL,
    sequence INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_recipe_ingredients_updated_at ON recipe_ingredients;
CREATE TRIGGER update_recipe_ingredients_updated_at BEFORE UPDATE ON recipe_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
