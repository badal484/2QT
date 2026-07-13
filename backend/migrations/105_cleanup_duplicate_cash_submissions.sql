-- Remove duplicate pending cash submissions, keeping the most recent one per rider.
-- This cleans up rows created before the deduplication guard was added (migration 104).
-- cash_submission_orders rows cascade-delete automatically.
DELETE FROM cash_submissions
WHERE status = 'pending'
  AND id NOT IN (
    SELECT DISTINCT ON (rider_id) id
    FROM cash_submissions
    WHERE status = 'pending'
    ORDER BY rider_id, submitted_at DESC
  );

-- Now safe to create the unique index (migration 104 may have failed if duplicates existed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_submissions_one_pending_per_rider
ON cash_submissions(rider_id)
WHERE status = 'pending';
