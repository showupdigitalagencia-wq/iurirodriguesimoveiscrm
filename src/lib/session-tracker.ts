import { supabase } from "@/integrations/supabase/client";

// Cada "sessão" representa um intervalo CONTÍNUO com o app em primeiro plano.
// Ao minimizar/trocar de app (visibilitychange→hidden ou pagehide) a sessão é
// IMEDIATAMENTE fechada. Ao voltar (visibilitychange→visible ou pageshow) uma
// nova sessão é aberta. Assim o tempo em background NUNCA é contabilizado,
// sem depender do timeout do heartbeat.
//
// O heartbeat continua existindo como rede de segurança: se o navegador matar
// a aba sem disparar pagehide (caso comum no iOS), o último heartbeat marca
// até onde o tempo deve ser contado.

const KEY = "nexus_session_id";
const USER_KEY = "nexus_session_user_id";
const HEARTBEAT_MS = 45_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let closing = false;

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
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function openSession(userId: string) {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_sessions" as never)
      .insert({ user_id: userId, last_heartbeat_at: nowIso } as never)
      .select("id")
      .single();
    if (error || !data) return null;
    const id = (data as { id: string }).id;
    localStorage.setItem(KEY, id);
    localStorage.setItem(USER_KEY, userId);
    startHeartbeat();
    return id;
  } catch { return null; }
}

async function closeSession() {
  if (closing) return;
  closing = true;
  try {
    stopHeartbeat();
    const id = localStorage.getItem(KEY);
    if (!id) return;
    localStorage.removeItem(KEY);
    const nowIso = new Date().toISOString();
    // Fecha imediatamente: logout_at = agora; duration = agora - login_at.
    const { data } = await supabase
      .from("user_sessions" as never)
      .select("login_at")
      .eq("id", id)
      .maybeSingle();
    const row = data as { login_at?: string } | null;
    const loginAt = row?.login_at;
    const duration = loginAt
      ? Math.max(0, Math.floor((Date.now() - new Date(loginAt).getTime()) / 1000))
      : null;
    await supabase
      .from("user_sessions" as never)
      .update({ logout_at: nowIso, last_heartbeat_at: nowIso, duration_seconds: duration } as never)
      .eq("id", id);
  } catch { /* noop */ }
  finally { closing = false; }
}

function handleHidden() {
  // Fecha sessão imediatamente quando o app vai pro background.
  void closeSession();
}

function handleVisible() {
  // Retoma abrindo uma NOVA sessão (intervalo contínuo de uso em foreground).
  if (localStorage.getItem(KEY)) {
    // já existe sessão aberta — só garante heartbeat
    startHeartbeat();
    return;
  }
  const uid = localStorage.getItem(USER_KEY);
  if (uid) void openSession(uid);
}

function attachVisibilityListeners() {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") handleVisible();
    else handleHidden();
  });

  // pagehide: disparado de forma mais confiável que beforeunload em mobile (iOS).
  window.addEventListener("pagehide", handleHidden);
  // pageshow: contraparte de pagehide (bfcache restore).
  window.addEventListener("pageshow", () => {
    if (document.visibilityState === "visible") handleVisible();
  });
  // blur de janela em desktop também é sinal forte de "saiu do app"
  window.addEventListener("blur", () => {
    if (document.visibilityState !== "visible") handleHidden();
  });
}

export async function startUserSession(userId: string) {
  attachVisibilityListeners();
  localStorage.setItem(USER_KEY, userId);
  const existing = localStorage.getItem(KEY);
  if (existing) {
    startHeartbeat();
    return existing;
  }
  // Só abre sessão se o app estiver visível agora.
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return null;
  }
  return await openSession(userId);
}

export async function endUserSession() {
  localStorage.removeItem(USER_KEY);
  await closeSession();
}

export async function endUserSessionBeacon() {
  void closeSession();
}
