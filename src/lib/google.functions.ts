import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function callbackUrl(): string {
  const host = getRequestHost();
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}/api/public/google-oauth-callback`;
}

export const startGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildGoogleAuthUrl, signState } = await import("@/lib/google.server");
    const state = signState(context.userId);
    const url = buildGoogleAuthUrl(callbackUrl(), state);
    return { url };
  });

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("google_tokens" as never)
      .select("google_email, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = data as { google_email: string | null; updated_at: string } | null;
    return { connected: !!row, email: row?.google_email ?? null };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("google_tokens" as never)
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verificarConflitoGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { start: string; end: string }) => {
    if (!input?.start || !input?.end) throw new Error("start e end obrigatórios");
    const s = new Date(input.start);
    const e = new Date(input.end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
      throw new Error("intervalo inválido");
    }
    return { start: s.toISOString(), end: e.toISOString() };
  })
  .handler(async ({ context, data }) => {
    const { queryFreeBusy } = await import("@/lib/google.server");
    return queryFreeBusy(context.userId, data.start, data.end);
  });
