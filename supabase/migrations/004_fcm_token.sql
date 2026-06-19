-- ─────────────────────────────────────────────────────────────────────────────
-- 004_fcm_token.sql
-- Adds FCM push notification support:
--   1. fcm_token column on profiles
--   2. Trigger: notify customer when their order status changes
--   3. Trigger: notify all admins when a new order is placed
--
-- Prerequisites:
--   • pg_net extension must be enabled (Supabase → Database → Extensions → pg_net)
--   • send-push edge function must be deployed
--   • Run these two settings once in SQL editor (replace placeholders):
--       ALTER DATABASE postgres SET "app.settings.edge_function_url" =
--         'https://<your-ref>.supabase.co/functions/v1/send-push';
--       ALTER DATABASE postgres SET "app.settings.service_role_key" =
--         '<your-service-role-key>';
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. FCM token column (already added via SQL editor, this is idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Customer notification — order status change
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_order_status_push()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  edge_url        TEXT;
  service_role_key TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  edge_url         := current_setting('app.settings.edge_function_url',  true);
  service_role_key := current_setting('app.settings.service_role_key',   true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'id',      NEW.id,
        'user_id', NEW.user_id,
        'status',  NEW.status
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change_push ON orders;

CREATE TRIGGER on_order_status_change_push
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_push();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Admin notification — new order placed
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_admins_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  edge_url         TEXT;
  service_role_key TEXT;
  customer_name    TEXT;
BEGIN
  edge_url         := current_setting('app.settings.edge_function_url',  true);
  service_role_key := current_setting('app.settings.service_role_key',   true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RETURN NEW;
  END IF;

  -- Extract customer name from the shipping JSONB field (fullName key)
  customer_name := COALESCE(
    NEW.shipping->>'fullName',
    NEW.shipping->>'name',
    'A customer'
  );

  -- Single HTTP call — the edge function queries all admin FCM tokens internally
  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body    := jsonb_build_object(
      'type',   'new_order',
      'record', jsonb_build_object(
        'id',            NEW.id,
        'user_id',       NEW.user_id,
        'customer_name', customer_name,
        'total',         NEW.total
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_order_admin_push ON orders;

CREATE TRIGGER on_new_order_admin_push
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_order();
