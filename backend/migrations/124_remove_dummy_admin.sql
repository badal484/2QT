-- Migration 124: Strip admin rights from the old dummy phone number and seed the real one.
-- (Hard-deleting 910000000000 failed in production via addresses_customer_id_fkey — it has
-- dependent rows in `addresses`. A plain UPDATE achieves the actual security goal, demoting it
-- to a harmless customer, without touching any FK-referenced row.)

UPDATE users SET role = 'customer' WHERE phone = '910000000000' AND role = 'super_admin';

INSERT INTO users (phone, name, role, is_verified, is_active)
VALUES ('917892493486', 'Admin', 'super_admin', true, true)
ON CONFLICT (phone) DO UPDATE SET role = 'super_admin', is_active = true, is_verified = true;
