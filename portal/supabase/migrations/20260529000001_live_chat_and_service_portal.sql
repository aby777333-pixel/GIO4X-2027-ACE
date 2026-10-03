-- ============================================================================
-- 20260529000001 · Live chat + customer-service portal foundation
-- ----------------------------------------------------------------------------
-- Additive. Introduces real-time live chat on top of the existing support
-- stack (support_tickets / ticket_messages stay untouched).
--
-- Adds:
--   enum   chat_status                  ('open','active','closed')
--   table  chat_conversations           one row per customer live-chat thread
--   table  chat_messages                messages within a conversation
--   RLS    self (own rows) + staff (is_staff()) on both tables — default deny
--   realtime: both tables added to the supabase_realtime publication
--   grants: authenticated / service_role (ready for 2026-10-30 grant flip)
--   trigger: bump conversation.last_message_at on each new message
--
-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages, public.chat_conversations;
--   DROP TABLE public.chat_messages;
--   DROP TABLE public.chat_conversations;
--   DROP FUNCTION public.tg_chat_touch_conversation();
--   DROP TYPE public.chat_status;
-- ============================================================================

-- 1 · enum -------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.chat_status AS ENUM ('open','active','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2 · tables -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject         text NOT NULL DEFAULT 'Live chat',
  status          public.chat_status NOT NULL DEFAULT 'open',
  assigned_staff  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_conv_user_idx     ON public.chat_conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS chat_conv_status_idx   ON public.chat_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS chat_conv_assigned_idx ON public.chat_conversations (assigned_staff);

DROP TRIGGER IF EXISTS chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  author_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_staff_reply  boolean NOT NULL DEFAULT false,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_conv_idx ON public.chat_messages (conversation_id, created_at);

-- 3 · keep conversation freshness in sync with messages ----------------------
CREATE OR REPLACE FUNCTION public.tg_chat_touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
     SET last_message_at = NEW.created_at,
         updated_at      = now(),
         -- a customer message on a closed thread reopens it
         status = CASE WHEN status = 'closed' AND NOT NEW.is_staff_reply THEN 'open' ELSE status END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_conv ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_conv AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_touch_conversation();

-- 4 · RLS (default deny) -----------------------------------------------------
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;

-- chat_conversations
DROP POLICY IF EXISTS chat_conv_self_select ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_self_insert ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_self_update ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_staff_all   ON public.chat_conversations;
CREATE POLICY chat_conv_self_select ON public.chat_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY chat_conv_self_insert ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY chat_conv_self_update ON public.chat_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY chat_conv_staff_all   ON public.chat_conversations FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- chat_messages
DROP POLICY IF EXISTS chat_msg_select ON public.chat_messages;
DROP POLICY IF EXISTS chat_msg_insert ON public.chat_messages;
DROP POLICY IF EXISTS chat_msg_staff  ON public.chat_messages;
CREATE POLICY chat_msg_select ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY chat_msg_insert ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_staff()
      OR (
        is_staff_reply = false
        AND EXISTS (
          SELECT 1 FROM public.chat_conversations c
          WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
        )
      )
    )
  );
CREATE POLICY chat_msg_staff ON public.chat_messages FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 5 · realtime publication ---------------------------------------------------
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages      REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6 · grants (explicit, ready for the 2026-10-30 public-schema grant flip) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.chat_conversations, public.chat_messages
TO authenticated, service_role;
