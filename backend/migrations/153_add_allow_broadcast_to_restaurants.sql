-- Migration 153: Add allow_broadcast permission flag to restaurants
--
-- Controls whether a tenant restaurant is authorized to launch self-serve push broadcast campaigns
-- to their own customer audience from the restaurant dashboard.
-- Default is FALSE (disabled) so an admin must explicitly grant broadcast permission to approved partners.

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS allow_broadcast BOOLEAN NOT NULL DEFAULT false;
