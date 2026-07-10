ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by TEXT;

-- Also add doc_review_status and doc_review_reason to rider_applications for granular doc review
ALTER TABLE rider_applications ADD COLUMN IF NOT EXISTS doc_review_status TEXT DEFAULT 'pending' CHECK (doc_review_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE rider_applications ADD COLUMN IF NOT EXISTS doc_review_reason TEXT;
ALTER TABLE rider_applications ADD COLUMN IF NOT EXISTS doc_reviewed_by TEXT;
ALTER TABLE rider_applications ADD COLUMN IF NOT EXISTS doc_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON users(is_suspended) WHERE is_suspended = TRUE;
