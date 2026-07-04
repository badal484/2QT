-- Add dine_in_staff to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dine_in_staff';
