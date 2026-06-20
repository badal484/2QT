-- Add missing user_role enum values that are used in the codebase
-- These were referenced in requireRole() middleware and team user creation but never added
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rider_captain';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
