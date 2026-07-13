-- Split payout flow: pending → approved → paid
-- 'approved' means an admin has reviewed and signed off; 'paid' means money has moved.
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'pending';
