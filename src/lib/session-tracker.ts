import { supabase } from "@/integrations/supabase/client";

const KEY = "nexus_session_id";
const HEARTBEAT_MS = 45_000; // pulso a cada 45s

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;

async function sendHeartbeat() {
  try {
    const id = localStorage.getItem(KEY);
    if (!id) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    await supabase
      .from("user_sessions" as never)
      .update({ last_heartbeat_at: new Date().toISOString() } as never)
      .eq("id", id);
  } catch { /* noop */ }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  // dispara um imediatamente e depois em intervalo
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function attachVisibilityListeners() {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      startHeartbeat();
    } else {
      // marca o último pulso ANTES de pausar para que o tempo conte até aqui
      sendHeartbeat();
      stopHeartbeat();
    }
  });
  // pagehide: melhor evento para "saiu" em mobile (especialmente iOS)
  window.addEventListener("pagehide", () => {
    sendHeartbeat();
    stopHeartbeat();
  });
  window.addEventListener("pageshow", () => {
    if (document.visibilityState === "visible") startHeartbeat();
  });
}

export async function startUserSession(userId: string) {
  try {
    attachVisibilityListeners();
    const existing = localStorage.getItem(KEY);
    if (existing) {
      startHeartbeat();
      return existing;
    }
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_sessions" as never)
      .insert({ user_id: userId, last_heartbeat_at: nowIso } as never)
      .select("id")
      .single();
    if (error || !data) return null;
    const id = (data as { id: string }).id;
    localStorage.setItem(KEY, id);
    startHeartbeat();
    return id;
  } catch { return null; }
}

export async function endUserSession() {
  try {
    stopHeartbeat();
    const id = localStorage.getItem(KEY);
    if (!id) return;
    localStorage.removeItem(KEY);
    const { data } = await supabase
      .from("user_sessions" as never)
      .select("login_at,last_heartbeat_at")
      .eq("id", id)
      .maybeSingle();
    const row = data as { login_at?: string; last_heartbeat_at?: string } | null;
    const loginAt = row?.login_at;
    // Tempo real = do login até o último heartbeat (capa o tempo ocioso/em background)
    const endRef = row?.last_heartbeat_at ?? new Date().toISOString();
    const duration = loginAt
      ? Math.max(0, Math.floor((new Date(endRef).getTime() - new Date(loginAt).getTime()) / 1000))
      : null;
    await supabase
      .from("user_sessions" as never)
      .update({ logout_at: endRef, duration_seconds: duration } as never)
      .eq("id", id);
  } catch { /* noop */ }
}

export async function endUserSessionBeacon() {
  endUserSession();
}
