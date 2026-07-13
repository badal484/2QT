-- Prevent riders from having more than one pending cash submission at a time.
-- The application layer already checks, but this index is the authoritative guard
-- against concurrent requests slipping through simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_submissions_one_pending_per_rider
ON cash_submissions(rider_id)
WHERE status = 'pending';
