import { supabase } from "@/integrations/supabase/client";

const KEY = "nexus_session_id";

export async function startUserSession(userId: string) {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("user_sessions" as never)
      .insert({ user_id: userId } as never)
      .select("id")
      .single();
    if (error || !data) return null;
    const id = (data as { id: string }).id;
    localStorage.setItem(KEY, id);
    return id;
  } catch { return null; }
}

export async function endUserSession() {
  try {
    const id = localStorage.getItem(KEY);
    if (!id) return;
    localStorage.removeItem(KEY);
    const now = new Date();
    const { data } = await supabase
      .from("user_sessions" as never)
      .select("login_at")
      .eq("id", id)
      .maybeSingle();
    const loginAt = (data as { login_at?: string } | null)?.login_at;
    const duration = loginAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(loginAt).getTime()) / 1000))
      : null;
    await supabase
      .from("user_sessions" as never)
      .update({ logout_at: now.toISOString(), duration_seconds: duration } as never)
      .eq("id", id);
  } catch { /* noop */ }
}

export async function endUserSessionBeacon() {
  // Best effort on tab close — supabase client uses fetch; this is sync-ish via sendBeacon would need REST URL.
  // Fall back to fire-and-forget update.
  endUserSession();
}
