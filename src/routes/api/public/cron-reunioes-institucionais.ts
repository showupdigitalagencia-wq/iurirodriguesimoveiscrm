import { createFileRoute } from "@tanstack/react-router";

// Recurring institutional meeting slots (local time, America/Sao_Paulo = UTC-3)
// Mon 19h, Tue 15h, Thu 17h, Sat 15h
const SLOTS: { weekday: number; hour: number; minute: number }[] = [
  { weekday: 1, hour: 19, minute: 0 },
  { weekday: 2, hour: 15, minute: 0 },
  { weekday: 4, hour: 17, minute: 0 },
  { weekday: 6, hour: 15, minute: 0 },
];

// Sao Paulo is UTC-3 (no DST since 2019)
const SP_OFFSET_HOURS = 3;
const WEEKS_AHEAD = 6;

function nextSlotDate(base: Date, weekday: number, hour: number, minute: number): Date {
  // Compute date in SP local that matches weekday + time, on/after base
  const d = new Date(base);
  const baseDow = d.getUTCDay();
  // SP day = UTC day shifted; for simplicity treat selected hour in SP, convert to UTC by +3
  let diff = (weekday - baseDow + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(hour + SP_OFFSET_HOURS, minute, 0, 0);
  if (d.getTime() < base.getTime()) {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d;
}

export const Route = createFileRoute("/api/public/cron-reunioes-institucionais")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const created: { titulo: string; data_inicio: string }[] = [];
        const skipped: string[] = [];

        for (let w = 0; w < WEEKS_AHEAD; w++) {
          const weekBase = new Date(now.getTime() + w * 7 * 24 * 60 * 60 * 1000);
          for (const slot of SLOTS) {
            const dt = nextSlotDate(weekBase, slot.weekday, slot.hour, slot.minute);
            if (dt.getTime() < now.getTime()) continue;
            const iso = dt.toISOString();

            const { data: existing } = await supabaseAdmin
              .from("reunioes" as never)
              .select("id")
              .eq("data_inicio", iso)
              .eq("recorrente", true)
              .maybeSingle();
            if (existing) {
              skipped.push(iso);
              continue;
            }
            const horaBR = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            const titulo = `Reunião Institucional — ${horaBR}`;
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
              } as never);
            if (error) {
              console.error("[cron-inst] insert", error);
            } else {
              created.push({ titulo, data_inicio: iso });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, created, skipped_count: skipped.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
