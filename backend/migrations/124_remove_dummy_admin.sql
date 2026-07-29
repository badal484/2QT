-- Migration 124: Delete old dummy super_admin phone number and ensure new one exists

DELETE FROM users WHERE phone = '910000000000';

INSERT INTO users (phone, name, role, is_verified, is_active)
VALUES ('917892493486', 'Admin', 'super_admin', true, true)
ON CONFLICT (phone) DO UPDATE SET role = 'super_admin', is_active = true, is_verified = true;
