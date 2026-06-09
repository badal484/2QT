-- Migration 010: Wallet, Loyalty, Referrals, Promo Codes
CREATE TABLE customer_wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID UNIQUE NOT NULL REFERENCES users(id),
    balance_paise INTEGER NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_customer_wallet_updated_at BEFORE UPDATE ON customer_wallet FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    amount_paise INTEGER NOT NULL,
    type wallet_transaction_type NOT NULL,
    reference_id UUID,
    description TEXT NOT NULL,
    balance_after_paise INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    points INTEGER NOT NULL,
    description TEXT NOT NULL,
    order_id UUID REFERENCES orders(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id),
    referred_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, rewarded, fraud_detected
    order_id UUID REFERENCES orders(id),
    referrer_rewarded_at TIMESTAMPTZ,
    referred_rewarded_at TIMESTAMPTZ,
    fraud_score INTEGER DEFAULT 0,
    referred_device_id TEXT,
    referred_ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type promo_discount_type NOT NULL,
    discount_value INTEGER NOT NULL,
    min_order_paise INTEGER DEFAULT 0,
    max_discount_paise INTEGER,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    applicable_to promo_applicable_to DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
