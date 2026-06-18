
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

UPDATE public.user_sessions
  SET last_heartbeat_at = COALESCE(logout_at, login_at)
  WHERE last_heartbeat_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_login ON public.user_sessions(user_id, login_at DESC);
