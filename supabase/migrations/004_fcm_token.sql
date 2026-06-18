-- Add FCM device token column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Trigger: call send-push edge function whenever an order's status changes
-- Requires pg_net extension and the send-push edge function to be deployed.
-- Replace <YOUR_SUPABASE_PROJECT_REF> with your actual project reference ID.

CREATE OR REPLACE FUNCTION notify_order_status_push()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  edge_url TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Build edge function URL from Supabase project URL env var (available in pg context)
  -- Or hardcode: 'https://<ref>.supabase.co/functions/v1/send-push'
  edge_url := current_setting('app.settings.edge_function_url', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    -- Fallback: derive from the supabase URL pattern
    -- You must set: ALTER DATABASE postgres SET "app.settings.edge_function_url" = 'https://<ref>.supabase.co/functions/v1/send-push';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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

-- Drop if exists so re-running the migration is safe
DROP TRIGGER IF EXISTS on_order_status_change_push ON orders;

CREATE TRIGGER on_order_status_change_push
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_push();
