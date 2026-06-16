-- ────────────────────────────────────────────
-- notifications
-- In-app notifications for order updates and new orders.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT        NOT NULL,          -- 'new_order' | 'status_update'
  title       TEXT,
  message     TEXT        NOT NULL DEFAULT '',
  message_am  TEXT        NOT NULL DEFAULT '',
  order_id    TEXT,
  link        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Fast per-user queries (newest first)
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- Row-Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable Realtime for the bell component
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
