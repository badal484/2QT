-- Migration 004: Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    is_active BOOLEAN DEFAULT true,
    referral_code TEXT UNIQUE,
    referred_by_id UUID REFERENCES users(id),
    kitchen_id UUID REFERENCES kitchens(id),
    zone_id UUID REFERENCES zones(id),
    upi_id TEXT,
    is_online BOOLEAN DEFAULT false,
    current_order_id UUID, -- Will be foreign key to orders later
    fcm_token TEXT,
    device_platform TEXT DEFAULT 'android',
    terms_accepted_at TIMESTAMPTZ,
    terms_version TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for referral code generation
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    IF NEW.referral_code IS NULL THEN
        LOOP
            new_code := upper(substring(md5(random()::text) from 1 for 8));
            SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        NEW.referral_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- Trigger for phone normalization
CREATE OR REPLACE FUNCTION normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
    -- Strip non-digits
    NEW.phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    
    -- If it starts with 0, remove it
    IF NEW.phone LIKE '0%' THEN
        NEW.phone := substr(NEW.phone, 2);
    END IF;

    -- Ensure it starts with 91
    IF length(NEW.phone) = 10 THEN
        NEW.phone := '91' || NEW.phone;
    ELSIF length(NEW.phone) = 12 AND NEW.phone NOT LIKE '91%' THEN
        -- This case is weird, maybe it's another country code. For VELTO we enforce 91.
        -- But if it's 12 digits and not starting with 91, it might be invalid for us.
        -- Let's just ensure it's 12 digits and starts with 91.
        NULL; 
    END IF;

    IF length(NEW.phone) != 12 OR NEW.phone NOT LIKE '91%' THEN
        RAISE EXCEPTION 'Invalid phone number format. Must be 12 digits starting with 91.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_phone
BEFORE INSERT OR UPDATE OF phone ON users
FOR EACH ROW EXECUTE FUNCTION normalize_phone();
