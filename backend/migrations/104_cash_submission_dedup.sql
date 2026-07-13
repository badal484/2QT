-- Remove any pre-existing duplicate pending submissions per rider (keep newest).
-- Must run before the unique index creation below, otherwise the index will fail
-- if duplicate rows are already in the table.
DELETE FROM cash_submissions
WHERE status = 'pending'
  AND id NOT IN (
    SELECT DISTINCT ON (rider_id) id
    FROM cash_submissions
    WHERE status = 'pending'
    ORDER BY rider_id, submitted_at DESC
  );

-- Enforce one pending submission per rider at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_submissions_one_pending_per_rider
ON cash_submissions(rider_id)
WHERE status = 'pending';
