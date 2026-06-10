-- Migration 038: Ensure super admin user exists in production
INSERT INTO users (phone, name, role, is_verified, is_active)
VALUES ('910000000000', 'Admin', 'super_admin', true, true)
ON CONFLICT (phone) DO UPDATE SET role = 'super_admin', is_active = true, is_verified = true;
