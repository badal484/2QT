-- Migration 018: Rider Session Tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_since TIMESTAMPTZ;

-- Update trigger for online status to track session start
CREATE OR REPLACE FUNCTION track_rider_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        NEW.online_since := NOW();
    ELSIF NEW.is_online = false THEN
        -- We could log the session here to a rider_sessions table if we wanted historical data
        NEW.online_since := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_rider_session
BEFORE UPDATE OF is_online ON users
FOR EACH ROW EXECUTE FUNCTION track_rider_session();
