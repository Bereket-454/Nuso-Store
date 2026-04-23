-- ============================================================
-- Referral System Migration
-- Append to (or run after) supabase/schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Extend profiles: referral_code + referred_by
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. orders table
--    Created here so referral columns are included from the start.
--    Uses CREATE TABLE IF NOT EXISTS so it is safe to re-run.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                        TEXT         PRIMARY KEY,
  user_id                   UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  customer_name             TEXT,
  customer_phone            TEXT,
  customer_email            TEXT,
  items                     JSONB        NOT NULL DEFAULT '[]',
  shipping                  JSONB        NOT NULL DEFAULT '{}',
  payment                   JSONB        NOT NULL DEFAULT '{}',
  subtotal                  INTEGER      NOT NULL DEFAULT 0,
  delivery_fee              INTEGER      NOT NULL DEFAULT 0,
  total                     INTEGER      NOT NULL DEFAULT 0,
  payment_status            TEXT         NOT NULL DEFAULT 'pending',
  status                    TEXT         NOT NULL DEFAULT 'confirmed',
  referral_discount         INTEGER      NOT NULL DEFAULT 0,
  wallet_credit_used        INTEGER      NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add referral columns to existing orders table (idempotent).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_credit_used  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders; admins can read all.
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Authenticated users and guests (anon) can insert.
CREATE POLICY "orders_insert_any"
  ON orders FOR INSERT WITH CHECK (true);

-- Admins can update order status.
CREATE POLICY "orders_update_admin"
  ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT ON orders TO anon;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. referrals table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed')),
  reward_given     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  UNIQUE (referred_user_id)   -- each user can be referred only once
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own"
  ON referrals FOR SELECT
  USING (
    referrer_id = auth.uid()
    OR referred_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT ON referrals TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. wallets table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  user_id     UUID            PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance_etb NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (balance_etb >= 0),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_select_own"
  ON wallets FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON wallets TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. wallet_transactions table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT            NOT NULL
              CHECK (type IN ('referral_reward', 'purchase_use', 'adjustment')),
  amount_etb  NUMERIC(12, 2)  NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_transactions_select_own"
  ON wallet_transactions FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON wallet_transactions TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. Update handle_new_user trigger
--    Auto-generates a unique referral code for every new user.
--    Processes referral_code_used from signup metadata.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code          TEXT;
  v_chars         TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt       INT  := 0;
  v_referral_code TEXT;
  v_referrer_id   UUID;
BEGIN
  -- Generate a unique NUSO-XXXXXX referral code.
  LOOP
    v_code :=
      'NUSO-' ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
      substr(v_chars, (floor(random() * 32) + 1)::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_code);
    v_attempt := v_attempt + 1;
    EXIT WHEN v_attempt > 20;
  END LOOP;

  -- Resolve referrer from signup metadata (set by client during sign-up form).
  v_referral_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code_used', '')));
  IF v_referral_code <> '' THEN
    SELECT id INTO v_referrer_id
    FROM profiles
    WHERE referral_code = v_referral_code;
    -- Discard if referrer not found or equals the new user (can't happen, but safe).
    IF v_referrer_id = NEW.id THEN
      v_referrer_id := NULL;
    END IF;
  END IF;

  -- Create the profile row.
  INSERT INTO profiles (id, email, phone, name, role, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'user',
    v_code,
    v_referrer_id
  )
  ON CONFLICT (id) DO UPDATE SET
    referral_code = EXCLUDED.referral_code,
    referred_by   = COALESCE(profiles.referred_by, EXCLUDED.referred_by);

  -- Create the referral record if a valid referrer was found.
  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO referrals (referrer_id, referred_user_id, status, reward_given)
    VALUES (v_referrer_id, NEW.id, 'pending', FALSE)
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 7. Backfill referral codes for existing users
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user   RECORD;
  v_code   TEXT;
  v_chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tries  INT;
BEGIN
  FOR v_user IN SELECT id FROM profiles WHERE referral_code IS NULL LOOP
    v_tries := 0;
    LOOP
      v_code :=
        'NUSO-' ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1) ||
        substr(v_chars, (floor(random() * 32) + 1)::int, 1);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_code);
      v_tries := v_tries + 1;
      EXIT WHEN v_tries > 20;
    END LOOP;
    UPDATE profiles SET referral_code = v_code WHERE id = v_user.id;
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. RPC: referral_code_exists
--    Anon-accessible — lets the sign-up form validate a code.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION referral_code_exists(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE referral_code = upper(trim(p_code))
  );
END;
$$;
GRANT EXECUTE ON FUNCTION referral_code_exists(TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 9. RPC: get_referral_stats
--    Returns referral code, counts, and wallet balance for a user.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code      TEXT;
  v_total     INT;
  v_pending   INT;
  v_completed INT;
  v_balance   NUMERIC;
BEGIN
  -- Guard: caller must be the user themselves or an admin.
  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT referral_code INTO v_code FROM profiles WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_total     FROM referrals WHERE referrer_id = p_user_id;
  SELECT COUNT(*) INTO v_pending   FROM referrals WHERE referrer_id = p_user_id AND status = 'pending';
  SELECT COUNT(*) INTO v_completed FROM referrals WHERE referrer_id = p_user_id AND status = 'completed';
  SELECT COALESCE(balance_etb, 0)  INTO v_balance FROM wallets WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'code',       v_code,
    'total',      COALESCE(v_total,     0),
    'pending',    COALESCE(v_pending,   0),
    'completed',  COALESCE(v_completed, 0),
    'balance',    COALESCE(v_balance,   0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_referral_stats(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 10. RPC: complete_referral_reward
--     Called after a confirmed Telebirr payment.
--     Awards 100 ETB to the referrer's wallet — idempotent (safe
--     to call multiple times; rewards only once per referred user).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_referral_reward(
  p_order_id TEXT,
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral  referrals%ROWTYPE;
  v_prior_orders INT;
BEGIN
  -- Guard: caller must be the referred user.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- This must be the user's FIRST paid order.
  SELECT COUNT(*) INTO v_prior_orders
  FROM orders
  WHERE user_id = p_user_id
    AND payment_status = 'paid'
    AND id <> p_order_id;

  IF v_prior_orders > 0 THEN
    RETURN jsonb_build_object('rewarded', FALSE, 'reason', 'not_first_order');
  END IF;

  -- Find an un-rewarded pending referral for this user.
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_user_id
    AND status = 'pending'
    AND reward_given = FALSE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('rewarded', FALSE, 'reason', 'no_pending_referral');
  END IF;

  -- Mark referral completed and reward given.
  UPDATE referrals
  SET status       = 'completed',
      reward_given = TRUE,
      completed_at = NOW()
  WHERE id = v_referral.id;

  -- Credit 100 ETB to referrer wallet (upsert).
  INSERT INTO wallets (user_id, balance_etb, updated_at)
  VALUES (v_referral.referrer_id, 100, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance_etb = wallets.balance_etb + 100,
        updated_at  = NOW();

  -- Audit log.
  INSERT INTO wallet_transactions (user_id, type, amount_etb, reference)
  VALUES (v_referral.referrer_id, 'referral_reward', 100, p_order_id);

  RETURN jsonb_build_object('rewarded', TRUE, 'referrer_id', v_referral.referrer_id);
END;
$$;
GRANT EXECUTE ON FUNCTION complete_referral_reward(TEXT, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 11. RPC: use_wallet_credit
--     Deducts wallet balance during checkout — atomic.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION use_wallet_credit(
  p_user_id  UUID,
  p_amount   NUMERIC,
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid_amount');
  END IF;

  -- Lock the row for atomic deduction.
  SELECT balance_etb INTO v_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance < p_amount THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'insufficient_balance');
  END IF;

  UPDATE wallets
  SET balance_etb = balance_etb - p_amount,
      updated_at  = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, type, amount_etb, reference)
  VALUES (p_user_id, 'purchase_use', -p_amount, p_order_id);

  RETURN jsonb_build_object('success', TRUE, 'new_balance', v_balance - p_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION use_wallet_credit(UUID, NUMERIC, TEXT) TO authenticated;
