import { createHmac, timingSafeEqual } from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

function hmacSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LOVABLE_API_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "fallback-secret"
  );
}

export function signState(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  const sig = createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): string | null {
  const [payload, sig] = (state ?? "").split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string };
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { email?: string };
    return j.email ?? null;
  } catch {
    return null;
  }
}

/** Get a valid access_token for a user, refreshing if needed. Returns null if not connected. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("google_tokens" as never)
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { access_token: string; refresh_token: string; expires_at: string } | null;
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return row.access_token;

  try {
    const refreshed = await refreshAccessToken(row.refresh_token);
    const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_tokens" as never)
      .update({ access_token: refreshed.access_token, expires_at: newExpires } as never)
      .eq("user_id", userId);
    return refreshed.access_token;
  } catch (e) {
    console.error("[Google] refresh failed for user", userId, e);
    return null;
  }
}

export type CreateMeetEventInput = {
  userId: string;
  summary: string;
  description?: string | null;
  startISO: string;
  durationMin: number;
  attendeesEmails?: string[];
};

export async function createCalendarEventWithMeet(input: CreateMeetEventInput): Promise<{
  htmlLink: string | null;
  meetLink: string | null;
  eventId: string | null;
} | null> {
  const token = await getValidAccessToken(input.userId);
  if (!token) return null;

  const start = new Date(input.startISO);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const requestId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const body = {
    summary: input.summary,
    description: input.description ?? undefined,
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
    attendees: (input.attendeesEmails ?? []).filter(Boolean).map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    console.error("[Google] create event failed", res.status, await res.text());
    return null;
  }
  const j = (await res.json()) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };
  const meetLink =
    j.hangoutLink ||
    j.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;
  return { htmlLink: j.htmlLink ?? null, meetLink, eventId: j.id ?? null };
}

export async function patchCalendarEventDescription(input: {
  userId: string;
  eventId: string;
  description: string;
}): Promise<boolean> {
  const token = await getValidAccessToken(input.userId);
  if (!token) return false;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: input.description }),
    },
  );
  if (!res.ok) {
    console.error("[Google] patch event failed", res.status, await res.text());
    return false;
  }
  return true;
}

export async function deleteCalendarEvent(input: {
  userId: string;
  eventId: string;
}): Promise<boolean> {
  const token = await getValidAccessToken(input.userId);
  if (!token) {
    console.warn("[Google] deleteCalendarEvent: no token for user", input.userId);
    return false;
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    console.error("[Google] delete event failed", res.status, await res.text());
    return false;
  }
  return true;
}

export type FreeBusyBlock = { start: string; end: string };

/**
 * Consulta o calendário primário do usuário e retorna os intervalos ocupados
 * que se sobrepõem ao período (start, end). Timeout de 3s — em caso de erro
 * ou ausência de token, retorna { verificado: false }.
 */
export async function queryFreeBusy(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<
  | { verificado: false; motivo: "sem_token" | "timeout" | "erro_api" }
  | { verificado: true; conflito: boolean; ocupados: FreeBusyBlock[] }
> {
  const token = await getValidAccessToken(userId);
  if (!token) return { verificado: false, motivo: "sem_token" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: startISO,
        timeMax: endISO,
        timeZone: "America/Sao_Paulo",
        items: [{ id: "primary" }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("[Google] freeBusy failed", res.status);
      return { verificado: false, motivo: "erro_api" };
    }
    const j = (await res.json()) as {
      calendars?: Record<string, { busy?: FreeBusyBlock[] }>;
    };
    const busy = j.calendars?.primary?.busy ?? [];
    return { verificado: true, conflito: busy.length > 0, ocupados: busy };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { verificado: false, motivo: "timeout" };
    }
    console.error("[Google] freeBusy error", e);
    return { verificado: false, motivo: "erro_api" };
  } finally {
    clearTimeout(timer);
  }
}
