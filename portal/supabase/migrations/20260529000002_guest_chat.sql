-- ============================================================================
-- 20260529000002 · Guest (web) live-chat support
-- ----------------------------------------------------------------------------
-- Additive. Lets the public GIO4X marketing site open live-chat threads for
-- anonymous visitors that land in the same staff console (/staff/chats) as
-- authenticated customer chats.
--
-- Guest threads are written by a trusted server (the marketing site's own
-- API using the service_role key) — never by the browser — so no anon RLS
-- policy is added. Staff (authenticated, is_staff()) keep full visibility via
-- the existing chat_conv_staff_all / chat_msg_staff policies.
--
-- Changes:
--   chat_conversations.user_id  -> nullable (guests have no portal profile)
--   chat_conversations          + guest_name, guest_email, source
--
-- ROLLBACK:
--   ALTER TABLE public.chat_conversations
--     DROP COLUMN IF EXISTS source,
--     DROP COLUMN IF EXISTS guest_email,
--     DROP COLUMN IF EXISTS guest_name;
--   -- (user_id can be set back to NOT NULL only once guest rows are removed)
-- ============================================================================

ALTER TABLE public.chat_conversations
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS guest_name  text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'portal';

-- Either an authenticated owner or a named guest must identify the thread.
DO $$ BEGIN
  ALTER TABLE public.chat_conversations
    ADD CONSTRAINT chat_conv_owner_or_guest
    CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
