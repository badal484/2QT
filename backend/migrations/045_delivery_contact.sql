-- Migration 045: Alternate delivery contact
-- Allows a customer to specify a different person to receive their order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_contact_phone TEXT;
