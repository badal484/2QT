-- Migration 151: Allow admin to delete users without FK constraint violations
--
-- Strategy:
--   - Personal data / user profiles / addresses / device tokens / wallet -> CASCADE
--   - Historical orders / invoices / financials / audit records -> SET NULL (preserves financial/accounting history while removing the user)

-- 1. orders (customer, rider, chef, packer links)
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rider_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_rider_id_fkey
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_claimed_by_chef_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_claimed_by_chef_id_fkey
  FOREIGN KEY (claimed_by_chef_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_packed_by_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_packed_by_id_fkey
  FOREIGN KEY (packed_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. refunds
ALTER TABLE refunds ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_customer_id_fkey;
ALTER TABLE refunds
  ADD CONSTRAINT refunds_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_initiated_by_fkey;
ALTER TABLE refunds
  ADD CONSTRAINT refunds_initiated_by_fkey
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_approved_by_fkey;
ALTER TABLE refunds
  ADD CONSTRAINT refunds_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. weekly_payouts
ALTER TABLE weekly_payouts ALTER COLUMN rider_id DROP NOT NULL;
ALTER TABLE weekly_payouts DROP CONSTRAINT IF EXISTS weekly_payouts_rider_id_fkey;
ALTER TABLE weekly_payouts
  ADD CONSTRAINT weekly_payouts_rider_id_fkey
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE weekly_payouts DROP CONSTRAINT IF EXISTS weekly_payouts_approved_by_fkey;
ALTER TABLE weekly_payouts
  ADD CONSTRAINT weekly_payouts_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 4. cash_submissions
ALTER TABLE cash_submissions ALTER COLUMN rider_id DROP NOT NULL;
ALTER TABLE cash_submissions DROP CONSTRAINT IF EXISTS cash_submissions_rider_id_fkey;
ALTER TABLE cash_submissions
  ADD CONSTRAINT cash_submissions_rider_id_fkey
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cash_submissions DROP CONSTRAINT IF EXISTS cash_submissions_collected_by_fkey;
ALTER TABLE cash_submissions
  ADD CONSTRAINT cash_submissions_collected_by_fkey
  FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL;

-- 5. restaurant_subscriptions
ALTER TABLE restaurant_subscriptions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE restaurant_subscriptions DROP CONSTRAINT IF EXISTS restaurant_subscriptions_created_by_fkey;
ALTER TABLE restaurant_subscriptions
  ADD CONSTRAINT restaurant_subscriptions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE restaurant_subscriptions DROP CONSTRAINT IF EXISTS restaurant_subscriptions_cancelled_by_fkey;
ALTER TABLE restaurant_subscriptions
  ADD CONSTRAINT restaurant_subscriptions_cancelled_by_fkey
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- 6. addresses / user_addresses
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
ALTER TABLE addresses
  ADD CONSTRAINT addresses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 7. customer_wallet & wallet_transactions
ALTER TABLE customer_wallet DROP CONSTRAINT IF EXISTS customer_wallet_customer_id_fkey;
ALTER TABLE customer_wallet
  ADD CONSTRAINT customer_wallet_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_customer_id_fkey;
ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
