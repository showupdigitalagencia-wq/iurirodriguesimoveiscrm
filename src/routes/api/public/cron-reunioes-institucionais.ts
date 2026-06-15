import { createFileRoute } from "@tanstack/react-router";

// Recurring institutional meeting slots — America/Sao_Paulo (UTC-3, sem DST desde 2019)
// JS getDay()/getUTCDay(): 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
const SLOTS: { weekday: number; hour: number; minute: number; label: string }[] = [
  { weekday: 1, hour: 19, minute: 0, label: "Segunda 19:00" },
  { weekday: 2, hour: 15, minute: 0, label: "Terça 15:00" },
  { weekday: 4, hour: 17, minute: 0, label: "Quinta 17:00" },
  { weekday: 6, hour: 15, minute: 0, label: "Sábado 15:00" },
];

const SP_OFFSET_HOURS = 3; // SP is UTC-3
const WEEKS_AHEAD = 6;

// Retorna a próxima ocorrência (em UTC) de "weekday HH:MM" em horário de Brasília,
// >= `after`. Como SP = UTC-3 fixo e as horas-alvo (15/17/19h SP = 18/20/22h UTC)
// estão dentro do mesmo dia UTC, podemos calcular o weekday a partir do UTC dia.
function nextSlotUTC(after: Date, weekday: number, hour: number, minute: number): Date {
  const targetUTCHour = hour + SP_OFFSET_HOURS; // 15→18, 17→20, 19→22
  const d = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), targetUTCHour, minute, 0, 0));
  const dow = d.getUTCDay();
  let diff = (weekday - dow + 7) % 7;
  if (diff === 0 && d.getTime() <= after.getTime()) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function spLabel(dt: Date): string {
  // YYYY-MM-DD HH:MM in SP
  const sp = new Date(dt.getTime() - SP_OFFSET_HOURS * 3600_000);
  const yyyy = sp.getUTCFullYear();
  const mm = String(sp.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sp.getUTCDate()).padStart(2, "0");
  const hh = String(sp.getUTCHours()).padStart(2, "0");
  const mi = String(sp.getUTCMinutes()).padStart(2, "0");
  const dows = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][sp.getUTCDay()];
  return `${dows} ${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

async function findAdminWithGoogle(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admins } = await supabaseAdmin
    .from("user_roles").select("user_id").eq("role", "admin");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (!ids.length) return null;
  const { data: toks } = await supabaseAdmin
    .from("google_tokens" as never).select("user_id").in("user_id", ids);
  return ((toks ?? []) as { user_id: string }[])[0]?.user_id ?? null;
}

export const Route = createFileRoute("/api/public/cron-reunioes-institucionais")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // GET = preview/health, opcionalmente ?preview=1 mostra próximas datas calculadas
        const url = new URL(request.url);
        if (url.searchParams.get("preview") === "1") {
          const now = new Date();
          const out: { slot: string; runs: string[] }[] = [];
          for (const slot of SLOTS) {
            const runs: string[] = [];
            let cursor = now;
            for (let w = 0; w < WEEKS_AHEAD; w++) {
              const dt = nextSlotUTC(cursor, slot.weekday, slot.hour, slot.minute);
              runs.push(`${dt.toISOString()} (${spLabel(dt)})`);
              cursor = new Date(dt.getTime() + 1000);
            }
            out.push({ slot: slot.label, runs });
          }
          return new Response(JSON.stringify({ ok: true, preview: out }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const created: { titulo: string; data_inicio: string; meet?: string | null }[] = [];
        const skipped: string[] = [];
        const errors: { iso: string; error: string }[] = [];

        const adminUserId = await findAdminWithGoogle();
        let createMeet: typeof import("@/lib/google.server").createCalendarEventWithMeet | null = null;
        if (adminUserId) {
          try {
            ({ createCalendarEventWithMeet: createMeet } = await import("@/lib/google.server"));
          } catch (e) {
            console.warn("[cron-inst] google import failed", e);
          }
        }

        for (const slot of SLOTS) {
          let cursor = now;
          for (let w = 0; w < WEEKS_AHEAD; w++) {
            const dt = nextSlotUTC(cursor, slot.weekday, slot.hour, slot.minute);
            cursor = new Date(dt.getTime() + 1000);
            const iso = dt.toISOString();

            const { data: existing } = await supabaseAdmin
              .from("reunioes" as never)
              .select("id, local")
              .eq("data_inicio", iso)
              .eq("recorrente", true)
              .maybeSingle();

            const horaBR = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;
            const titulo = `Reunião Institucional — ${horaBR}`;

            if (existing) {
              const ex = existing as { id: string; local: string | null };
              // Se já existe mas sem link, tenta gerar
              if (!ex.local && createMeet && adminUserId) {
                try {
                  const ev = await createMeet({
                    userId: adminUserId,
                    summary: titulo,
                    description: "Reunião institucional semanal com o Diretor Geral Iuri Rodrigues.",
                    startISO: iso,
                    durationMin: 60,
                  });
                  if (ev?.meetLink) {
                    await supabaseAdmin.from("reunioes" as never)
                      .update({ local: ev.meetLink, google_event_ids: ev.eventId ? [{ user_id: adminUserId, event_id: ev.eventId }] : [] } as never)
                      .eq("id", ex.id);
                  }
                } catch (e) {
                  console.warn("[cron-inst] meet update failed", e);
                }
              }
              skipped.push(iso);
              continue;
            }

            let meetLink: string | null = null;
            let eventId: string | null = null;
            if (createMeet && adminUserId) {
              try {
                const ev = await createMeet({
                  userId: adminUserId,
                  summary: titulo,
                  description: "Reunião institucional semanal com o Diretor Geral Iuri Rodrigues.",
                  startISO: iso,
                  durationMin: 60,
                });
                meetLink = ev?.meetLink ?? null;
                eventId = ev?.eventId ?? null;
              } catch (e) {
                console.warn("[cron-inst] meet create failed", e);
              }
            }

            const { error } = await supabaseAdmin
              .from("reunioes" as never)
              .insert({
                titulo,
                descricao: "Reunião institucional semanal com o Diretor Geral Iuri Rodrigues.",
                data_inicio: iso,
                duracao_min: 60,
                tipo: "institucional",
                status: "agendada",
                recorrente: true,
                local: meetLink,
                google_event_ids: eventId && adminUserId ? [{ user_id: adminUserId, event_id: eventId }] : [],
              } as never);
            if (error) {
              console.error("[cron-inst] insert", error);
              errors.push({ iso, error: error.message });
            } else {
              created.push({ titulo, data_inicio: iso, meet: meetLink });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, admin_google: !!adminUserId, created, skipped_count: skipped.length, errors }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
