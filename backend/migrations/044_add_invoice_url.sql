-- Migration 044: Add missing invoice_url column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_url TEXT;
