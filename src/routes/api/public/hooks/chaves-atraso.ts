import { createFileRoute } from "@tanstack/react-router";

// Cron horário. Varre imóveis com chave_com_id != null e chave_retirada_em
// mais antigo que `chaves_atraso_horas` (default 24). Envia push ao corretor
// que retirou + captador (se houver) e admins como fallback. Marca
// `chave_atraso_notificado_em` para não reenviar.

type ConfigRow = { valor: unknown };
type ImovelRow = {
  id: string;
  codigo: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  captador_id: string | null;
  chave_com_id: string;
  chave_retirada_em: string;
};

export const Route = createFileRoute("/api/public/hooks/chaves-atraso")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Notificações de chaves atrasadas (POST p/ rodar)" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const { data: cfg } = await supabaseAdmin
          .from("configuracoes")
          .select("valor")
          .eq("chave", "chaves_atraso_horas")
          .maybeSingle();
        const raw = (cfg as ConfigRow | null)?.valor;
        const horas = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) || 24 : 24;
        const cutoffIso = new Date(Date.now() - horas * 3600 * 1000).toISOString();

        const { data: rows } = await supabaseAdmin
          .from("imoveis")
          .select("id, codigo, rua, numero, bairro, cidade, captador_id, chave_com_id, chave_retirada_em")
          .not("chave_com_id", "is", null)
          .not("chave_retirada_em", "is", null)
          .lte("chave_retirada_em", cutoffIso)
          .is("chave_atraso_notificado_em", null);
        const imoveis = (rows ?? []) as ImovelRow[];

        if (!imoveis.length) {
          return new Response(JSON.stringify({ ok: true, processados: 0, horas }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const userIds = new Set<string>();
        for (const i of imoveis) {
          userIds.add(i.chave_com_id);
          if (i.captador_id) userIds.add(i.captador_id);
        }
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, nome, onesignal_external_id")
          .in("id", Array.from(userIds));
        const profMap = new Map<string, { nome: string | null; ext: string | null }>();
        for (const p of (profs ?? []) as { id: string; nome: string | null; onesignal_external_id: string | null }[]) {
          profMap.set(p.id, { nome: p.nome, ext: p.onesignal_external_id });
        }

        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = Array.from(new Set((admins ?? []).map((r) => r.user_id as string)));
        const { data: adminProfs } = adminIds.length
          ? await supabaseAdmin.from("profiles").select("id, onesignal_external_id").in("id", adminIds)
          : { data: [] as { id: string; onesignal_external_id: string | null }[] };
        const adminExtIds = (adminProfs ?? [])
          .map((p) => p.onesignal_external_id)
          .filter((x): x is string => !!x);

        const agora = new Date().toISOString();
        let pushOk = 0, pushFail = 0;
        const erros: string[] = [];

        for (const im of imoveis) {
          const endereco = [
            [im.rua, im.numero].filter(Boolean).join(", "),
            im.bairro,
            im.cidade,
          ].filter(Boolean).join(" — ");
          const corretor = profMap.get(im.chave_com_id);
          const horasAtraso = Math.floor((Date.now() - new Date(im.chave_retirada_em).getTime()) / 3600000);

          const targets = new Set<string>();
          if (corretor?.ext) targets.add(corretor.ext);
          if (im.captador_id) {
            const cap = profMap.get(im.captador_id);
            if (cap?.ext) targets.add(cap.ext);
          }
          if (targets.size === 0) {
            for (const a of adminExtIds) targets.add(a);
          }

          if (targets.size === 0) {
            pushFail++;
            erros.push(`sem destinatarios para ${im.id}`);
          } else {
            const r = await sendOneSignalPush({
              externalIds: Array.from(targets),
              title: "🔑 Chave em atraso",
              message: `${im.codigo ?? ""} ${endereco} — com ${corretor?.nome ?? "corretor"} há ${horasAtraso}h.`,
              url: `https://sistemanexus.app/admin/chaves?open=${im.id}`,
              data: { tipo: "chave_atraso", imovel_id: im.id, horas_atraso: horasAtraso },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          }

          await supabaseAdmin
            .from("imoveis")
            .update({ chave_atraso_notificado_em: agora } as never)
            .eq("id", im.id);
        }

        return new Response(JSON.stringify({
          ok: true, horas, processados: imoveis.length,
          push_ok: pushOk, push_fail: pushFail, erros: erros.slice(0, 5),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
