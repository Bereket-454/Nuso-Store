-- Enable Supabase Realtime for the orders table.
-- REPLICA IDENTITY FULL ensures all column values are included in UPDATE
-- events so row-level filters (e.g. user_id=eq.xxx) work correctly.
-- The DO block makes the publication change idempotent.
ALTER TABLE orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
