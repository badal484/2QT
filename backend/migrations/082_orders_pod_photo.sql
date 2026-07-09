-- Proof-of-delivery photo URL, captured by rider before entering OTP
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_photo_url TEXT;
