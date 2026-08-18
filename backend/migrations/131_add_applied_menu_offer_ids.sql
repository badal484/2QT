-- Migration 131: Add applied_menu_offer_ids to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_menu_offer_ids UUID[] DEFAULT '{}';
