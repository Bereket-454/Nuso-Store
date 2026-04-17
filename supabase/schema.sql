-- ============================================================
-- Dire e-commerce schema
-- Run this in the Supabase SQL editor to set up all tables.
-- ============================================================

-- ────────────────────────────────────────────
-- products
-- Mirrors the product shape in src/data/mockData.js.
-- colors / sizes / images are stored as text arrays.
-- Snake_case columns map to camelCase in productsService.js.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK (category IN ('men', 'women', 'children')),
  subcategory     TEXT    NOT NULL CHECK (subcategory IN ('apparel', 'shoes', 'perfumes', 'appliances')),
  price           INTEGER NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0,
  colors          TEXT[]  NOT NULL DEFAULT '{}',
  sizes           TEXT[]  NOT NULL DEFAULT '{}',
  description     TEXT,
  images          TEXT[]  NOT NULL DEFAULT '{}',
  is_best_seller  BOOLEAN NOT NULL DEFAULT false,
  is_new_arrival  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- products RLS
-- Public read so unauthenticated users can browse the catalogue.
-- Write (insert / update / delete) restricted to admin users only.
-- ────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_public"
  ON products FOR SELECT USING (true);

CREATE POLICY "products_write_admin"
  ON products FOR ALL
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ────────────────────────────────────────────
-- product_requests
-- Customers can submit a product request with a photo, description, and Telegram contact.
-- Admins review and update the status from the admin dashboard.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_requests (
  id             BIGSERIAL    PRIMARY KEY,
  photo_url      TEXT         NOT NULL,
  product_name   TEXT         NOT NULL,
  description    TEXT         NOT NULL,
  budget         TEXT,
  customer_name  TEXT         NOT NULL,
  telegram_phone TEXT         NOT NULL,
  extra_details  TEXT,
  status         TEXT         NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'contacted', 'fulfilled', 'rejected')),
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;

-- Grant the basic table privilege first — RLS policies alone are not enough.
-- Both anon (unauthenticated visitors) and authenticated users must be able to submit.
GRANT INSERT ON product_requests TO anon;
GRANT INSERT ON product_requests TO authenticated;

-- Allow SELECT/UPDATE for authenticated users so the admin dashboard can read and
-- update requests (the policy below further restricts to admin-role users only).
GRANT SELECT, UPDATE ON product_requests TO authenticated;

-- Sequence must also be granted so BIGSERIAL can generate the id.
GRANT USAGE, SELECT ON SEQUENCE product_requests_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE product_requests_id_seq TO authenticated;

-- Anyone (including unauthenticated visitors) can insert a request.
CREATE POLICY "product_requests_insert_public"
  ON product_requests FOR INSERT WITH CHECK (true);

-- Only admins can read all requests.
CREATE POLICY "product_requests_select_admin"
  ON product_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Only admins can update status.
CREATE POLICY "product_requests_update_admin"
  ON product_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ────────────────────────────────────────────
-- categories  (primary audience nav: men / women / children)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- ────────────────────────────────────────────
-- subcategories  (product type filters)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcategories (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- ────────────────────────────────────────────
-- promotions  (banner / offer cards on HomePage)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  details    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Seed data — matches src/data/mockData.js exactly
-- ============================================================

INSERT INTO categories (slug, label) VALUES
  ('men',      'Men'),
  ('women',    'Women'),
  ('children', 'Children')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subcategories (slug, label) VALUES
  ('apparel',    'Clothing'),
  ('shoes',      'Shoes'),
  ('perfumes',   'Perfumes'),
  ('appliances', 'Appliances')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO promotions (id, title, details) VALUES
  ('promo-1', 'Weekend Flash Sale',       'Up to 25% off selected shoes and perfumes.'),
  ('promo-2', 'Free Delivery Threshold',  'Delivery fee waived on orders above ETB 12,000.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products
  (id, name, category, subcategory, price, stock, colors, sizes, description, images, is_best_seller, is_new_arrival)
VALUES
  (
    'p-001', 'Classic Cotton Shirt', 'men', 'apparel', 1850, 24,
    ARRAY['Black', 'White', 'Blue'],
    ARRAY['M', 'L', 'XL'],
    'Breathable cotton shirt for smart casual outfits.',
    ARRAY['https://picsum.photos/seed/dire-shirt-1/640/640', 'https://picsum.photos/seed/dire-shirt-2/640/640'],
    true, false
  ),
  (
    'p-002', 'Urban Women Blazer', 'women', 'apparel', 3200, 17,
    ARRAY['Black', 'Beige'],
    ARRAY['S', 'M', 'L'],
    'Tailored blazer with soft inner lining for all-day wear.',
    ARRAY['https://picsum.photos/seed/dire-blazer-1/640/640', 'https://picsum.photos/seed/dire-blazer-2/640/640'],
    true, true
  ),
  (
    'p-003', 'Kids Play Set', 'children', 'apparel', 1450, 35,
    ARRAY['Green', 'Yellow'],
    ARRAY['5-6Y', '7-8Y'],
    'Durable and soft fabric set for active kids.',
    ARRAY['https://picsum.photos/seed/dire-kids-1/640/640', 'https://picsum.photos/seed/dire-kids-2/640/640'],
    false, true
  ),
  (
    'p-004', 'Runner Street Sneakers', 'men', 'shoes', 4100, 12,
    ARRAY['White', 'Gray'],
    ARRAY['40', '41', '42', '43'],
    'Lightweight sneakers designed for comfort and style.',
    ARRAY['https://picsum.photos/seed/dire-shoe-1/640/640', 'https://picsum.photos/seed/dire-shoe-2/640/640'],
    true, false
  ),
  (
    'p-005', 'Amber Night Perfume', 'women', 'perfumes', 2900, 30,
    ARRAY['N/A'],
    ARRAY['50ml', '100ml'],
    'Long-lasting scent with woody and amber notes.',
    ARRAY['https://picsum.photos/seed/dire-perfume-1/640/640', 'https://picsum.photos/seed/dire-perfume-2/640/640'],
    false, true
  ),
  (
    'p-006', 'Compact Air Fryer', 'women', 'appliances', 6900, 8,
    ARRAY['Black'],
    ARRAY['4L'],
    'Energy-efficient air fryer with digital controls.',
    ARRAY['https://picsum.photos/seed/dire-appliance-1/640/640', 'https://picsum.photos/seed/dire-appliance-2/640/640'],
    true, false
  ),
  (
    'p-007', 'Slim Fit Jeans', 'men', 'apparel', 2300, 27,
    ARRAY['Indigo', 'Black'],
    ARRAY['30', '32', '34', '36'],
    'Modern slim-fit jeans with stretch comfort.',
    ARRAY['https://picsum.photos/seed/dire-jean-1/640/640', 'https://picsum.photos/seed/dire-jean-2/640/640'],
    false, true
  ),
  (
    'p-008', 'Women Soft Knit Dress', 'women', 'apparel', 2550, 14,
    ARRAY['Cream', 'Olive'],
    ARRAY['S', 'M', 'L'],
    'Soft knit dress with elegant minimal silhouette.',
    ARRAY['https://picsum.photos/seed/dire-dress-1/640/640', 'https://picsum.photos/seed/dire-dress-2/640/640'],
    false, true
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Auth: profiles table
-- One row per Supabase Auth user. The `role` column is the
-- server-side source of truth for admin access — never derived
-- from client input.
--
-- To promote a user to admin, run in the Supabase SQL editor:
--   UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  phone      TEXT,
  name       TEXT         NOT NULL DEFAULT '',
  role       TEXT         NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Add email column if upgrading an existing schema that predates this migration.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users may only read, insert, or update their own row.
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE  USING (auth.uid() = id);

-- ────────────────────────────────────────────
-- Trigger: auto-create a profile row on first login.
-- Runs with SECURITY DEFINER so it can bypass RLS.
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, phone, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────
-- phone_exists(p_phone)
-- Called by unauthenticated clients during sign-up to detect duplicate phone
-- numbers before submitting. Returns BOOLEAN only — no profile data is exposed.
-- SECURITY DEFINER bypasses RLS; GRANT TO anon makes it callable with the
-- Supabase anon key without a session.
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION phone_exists(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE phone = p_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION phone_exists TO anon;
GRANT EXECUTE ON FUNCTION phone_exists TO authenticated;

-- ────────────────────────────────────────────
-- email_exists(p_email)
-- Called during sign-in error handling to distinguish "wrong password" from
-- "no account". SECURITY DEFINER bypasses RLS so it works for anon callers.
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE email = lower(p_email));
END;
$$;

GRANT EXECUTE ON FUNCTION email_exists TO anon;
GRANT EXECUTE ON FUNCTION email_exists TO authenticated;
