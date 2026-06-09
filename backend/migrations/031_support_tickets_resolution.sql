-- Add resolution column to support_tickets for admin to record resolution notes
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS resolution TEXT;
