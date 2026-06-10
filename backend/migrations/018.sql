-- Migration 018: Rider Session Tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_since TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION track_rider_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        NEW.online_since := NOW();
    ELSIF NEW.is_online = false THEN
        NEW.online_since := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_rider_session ON users;
CREATE TRIGGER trigger_track_rider_session
BEFORE UPDATE OF is_online ON users
FOR EACH ROW EXECUTE FUNCTION track_rider_session();
