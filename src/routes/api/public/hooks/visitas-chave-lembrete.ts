import { createFileRoute } from "@tanstack/react-router";

// Cron a cada 15 min. Encontra visitas agendadas nas próximas 2h que possuem
// imovel_id vinculado e ainda não receberam lembrete de retirada de chave.
// Envia push ao corretor da visita lembrando de retirar a chave.

type VisitaRow = {
  id: string;
  corretor_id: string;
  imovel_id: string;
  data_inicio: string;
  endereco: string | null;
};

type ImovelRow = {
  id: string;
  codigo: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  chave_com_id: string | null;
};

export const Route = createFileRoute("/api/public/hooks/visitas-chave-lembrete")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Lembretes de chave de visita (POST p/ rodar)" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const agora = new Date();
        const limite = new Date(agora.getTime() + 2 * 3600 * 1000);

        const { data: rows } = await supabaseAdmin
          .from("vendas_visitas")
          .select("id, corretor_id, imovel_id, data_inicio, endereco")
          .not("imovel_id", "is", null)
          .gte("data_inicio", agora.toISOString())
          .lte("data_inicio", limite.toISOString())
          .is("chave_lembrete_enviado_em", null)
          .neq("status", "cancelada");
        const visitas = (rows ?? []) as VisitaRow[];

        if (!visitas.length) {
          return new Response(JSON.stringify({ ok: true, processadas: 0 }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const imovelIds = Array.from(new Set(visitas.map((v) => v.imovel_id)));
        const corretorIds = Array.from(new Set(visitas.map((v) => v.corretor_id)));

        const { data: imoveis } = await supabaseAdmin
          .from("imoveis")
          .select("id, codigo, rua, numero, bairro, chave_com_id")
          .in("id", imovelIds);
        const imovelMap = new Map<string, ImovelRow>();
        for (const i of (imoveis ?? []) as ImovelRow[]) imovelMap.set(i.id, i);

        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, onesignal_external_id")
          .in("id", corretorIds);
        const profMap = new Map<string, string | null>();
        for (const p of (profs ?? []) as { id: string; onesignal_external_id: string | null }[]) {
          profMap.set(p.id, p.onesignal_external_id);
        }

        const agoraIso = agora.toISOString();
        let pushOk = 0, pushFail = 0, skip = 0;
        const erros: string[] = [];

        for (const v of visitas) {
          const im = imovelMap.get(v.imovel_id);
          const ext = profMap.get(v.corretor_id);
          if (!im || !ext) {
            skip++;
          } else {
            const endereco = [
              [im.rua, im.numero].filter(Boolean).join(", "),
              im.bairro,
            ].filter(Boolean).join(" — ") || v.endereco || "";
            const minutos = Math.round((new Date(v.data_inicio).getTime() - agora.getTime()) / 60000);
            const jaComOutro = im.chave_com_id && im.chave_com_id !== v.corretor_id;
            const msg = jaComOutro
              ? `Visita em ${minutos} min — a chave de ${im.codigo ?? endereco} está com outro corretor. Combine a transferência.`
              : `Visita em ${minutos} min — não esqueça de retirar a chave de ${im.codigo ?? endereco}.`;
            const r = await sendOneSignalPush({
              externalId: ext,
              title: "🔑 Lembrete de chave para visita",
              message: msg,
              url: `https://sistemanexus.app/admin/chaves?open=${v.imovel_id}`,
              data: { tipo: "visita_chave_lembrete", visita_id: v.id, imovel_id: v.imovel_id },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          }
          await supabaseAdmin
            .from("vendas_visitas")
            .update({ chave_lembrete_enviado_em: agoraIso } as never)
            .eq("id", v.id);
        }

        return new Response(JSON.stringify({
          ok: true, processadas: visitas.length,
          push_ok: pushOk, push_fail: pushFail, skip, erros: erros.slice(0, 5),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
