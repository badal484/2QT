-- Migration 114: Add 'packer' to user_role enum
-- The packer station role was added in migration 103 (orders/state machine) but
-- the user_role enum value was never added, causing every kitchen login to crash
-- with "invalid input value for enum user_role: packer" inside verify-otp.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'packer';
