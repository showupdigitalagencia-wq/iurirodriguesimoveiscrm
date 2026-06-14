import { createFileRoute } from "@tanstack/react-router";

type Lembrete = "1d" | "1h" | "15min";

const WINDOWS: { tipo: Lembrete; minBefore: number }[] = [
  { tipo: "1d", minBefore: 24 * 60 },
  { tipo: "1h", minBefore: 60 },
  { tipo: "15min", minBefore: 15 },
];
const TOLERANCE_MIN = 5;

export const Route = createFileRoute("/api/public/cron-reuniao-lembretes")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const now = new Date();
        const horizonte = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        const { data: reunioes } = await supabaseAdmin
          .from("reunioes" as never)
          .select("id, titulo, data_inicio, tipo, status")
          .gte("data_inicio", now.toISOString())
          .lte("data_inicio", horizonte.toISOString())
          .eq("status", "agendada");

        const results: unknown[] = [];

        for (const rRaw of (reunioes ?? []) as unknown as { id: string; titulo: string; data_inicio: string; tipo: string }[]) {
          const start = new Date(rRaw.data_inicio).getTime();
          const minToStart = Math.round((start - now.getTime()) / 60000);

          for (const w of WINDOWS) {
            if (Math.abs(minToStart - w.minBefore) > TOLERANCE_MIN) continue;

            // já enviado?
            const { data: existing } = await supabaseAdmin
              .from("reuniao_lembretes" as never)
              .select("id")
              .eq("reuniao_id", rRaw.id)
              .eq("tipo", w.tipo)
              .maybeSingle();
            if (existing) continue;

            // destinatários: leads + corretores participantes + admins
            const { data: parts } = await supabaseAdmin
              .from("reuniao_participantes" as never)
              .select("lead_id, responsavel_id")
              .eq("reuniao_id", rRaw.id);

            const respIds = ((parts ?? []) as { responsavel_id: string | null }[])
              .map((p) => p.responsavel_id).filter((x): x is string => !!x);
            const leadIds = ((parts ?? []) as { lead_id: string | null }[])
              .map((p) => p.lead_id).filter((x): x is string => !!x);

            const respExt: string[] = [];
            if (respIds.length) {
              const { data: rs } = await supabaseAdmin
                .from("responsaveis").select("onesignal_external_id").in("id", respIds);
              respExt.push(...((rs ?? []).map((r) => r.onesignal_external_id).filter((x): x is string => !!x)));
            }

            // admins
            const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
            const adminIds = (adminRoles ?? []).map((r) => r.user_id);
            const { data: adminProfiles } = adminIds.length
              ? await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", adminIds)
              : { data: [] as { onesignal_external_id: string | null }[] };
            const adminExt = (adminProfiles ?? []).map((p) => p.onesignal_external_id).filter((x): x is string => !!x);

            // leads via profiles linked by responsavel_id — não aplicável; só corretores recebem push
            void leadIds;

            const externalIds = Array.from(new Set([...respExt, ...adminExt]));

            const dt = new Date(rRaw.data_inicio);
            const label = w.tipo === "1d" ? "Amanhã" : w.tipo === "1h" ? "Em 1 hora" : "Em 15 minutos";
            const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            const title = `Lembrete: ${rRaw.titulo}`;
            const message = `${label} às ${hora}`;
            const url = `https://iurirodriguesimoveiscrm.lovable.app/agenda?open=${rRaw.id}`;

            const res = externalIds.length
              ? await sendOneSignalPush({ externalIds, title, message, url, data: { reuniao_id: rRaw.id, lembrete: w.tipo } })
              : await sendOneSignalPush({ segments: ["All"], title, message, url, data: { reuniao_id: rRaw.id, lembrete: w.tipo } });

            await supabaseAdmin.from("reuniao_lembretes" as never).insert({
              reuniao_id: rRaw.id, tipo: w.tipo,
            } as never);

            results.push({ reuniaoId: rRaw.id, tipo: w.tipo, externalIds, ok: res.ok, error: res.error });
          }
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
