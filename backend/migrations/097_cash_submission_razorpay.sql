-- Allow razorpay_link as a submission method
ALTER TABLE cash_submissions
  DROP CONSTRAINT IF EXISTS cash_submissions_method_check;

ALTER TABLE cash_submissions
  ADD CONSTRAINT cash_submissions_method_check
    CHECK (method IN ('physical', 'upi_transfer', 'razorpay_link'));

-- Store the Razorpay Payment Link details
ALTER TABLE cash_submissions
  ADD COLUMN IF NOT EXISTS razorpay_link_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_link_url TEXT;
