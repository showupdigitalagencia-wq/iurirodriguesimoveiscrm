import { createFileRoute } from "@tanstack/react-router";

type Regiao = "barra_da_tijuca" | "recreio" | "belford_roxo" | "nilopolis" | "mesquita" | "jacarepagua" | "zona_sul" | "zona_norte" | "zona_oeste" | "centro" | "outras";

const MAPA: Record<Regiao, "denise" | "fabiola" | "renata" | "robson"> = {
  barra_da_tijuca: "robson",
  recreio: "fabiola",
  belford_roxo: "renata",
  nilopolis: "denise",
  mesquita: "denise",
  jacarepagua: "robson",
  zona_sul: "robson",
  zona_norte: "renata",
  zona_oeste: "fabiola",
  centro: "robson",
  outras: "robson",
};

const REGIOES: Regiao[] = ["barra_da_tijuca", "recreio", "belford_roxo", "nilopolis", "mesquita", "jacarepagua", "zona_sul", "zona_norte", "zona_oeste", "centro", "outras"];

// Pega valor de várias chaves possíveis (case-insensitive)
function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

// Achata payload do Meta Lead Ads (field_data: [{name, values:[...]}])
function flattenMeta(body: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...body };
  const fd = (body.field_data ?? (body as { fields?: unknown }).fields) as
    | Array<{ name?: string; values?: unknown[] }>
    | undefined;
  if (Array.isArray(fd)) {
    for (const f of fd) {
      if (f?.name && Array.isArray(f.values) && f.values.length) {
        flat[f.name] = f.values[0];
      }
    }
  }
  return flat;
}

function detectRegiao(value: string | undefined): Regiao {
  if (!value) return "outras";
  const v = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v.includes("barra")) return "barra_da_tijuca";
  if (v.includes("recreio")) return "recreio";
  if (v.includes("belford")) return "belford_roxo";
  if (v.includes("nilopolis")) return "nilopolis";
  if (v.includes("mesquita")) return "mesquita";
  if (v.includes("jacarepagua") || v.includes("jacare")) return "jacarepagua";
  if (v.includes("zona sul") || v.includes("zona_sul") || v.includes("sul")) return "zona_sul";
  if (v.includes("zona norte") || v.includes("zona_norte") || v.includes("norte")) return "zona_norte";
  if (v.includes("zona oeste") || v.includes("zona_oeste") || v.includes("oeste")) return "zona_oeste";
  if (v.includes("centro")) return "centro";
  const key = v.replace(/\s+/g, "_") as Regiao;
  if (REGIOES.includes(key)) return key;
  return "outras";
}

export const Route = createFileRoute("/api/public/webhook")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true, endpoint: "webhook" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),

      POST: async ({ request }) => {
        let raw: unknown;
        try { raw = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const flat = flattenMeta(body);

        const nome = pick(flat, ["nome", "name", "full_name", "fullname", "nome_completo"]) ?? "Sem nome";
        const telefone = pick(flat, ["telefone", "phone", "phone_number", "telephone", "celular", "whatsapp"]) ?? "";
        const email = pick(flat, ["email", "e-mail", "mail"]);
        const regiaoStr = pick(flat, ["regiao", "região", "region", "bairro", "localizacao", "localização", "city", "cidade"]);
        const tipo_imovel = pick(flat, ["tipo_imovel", "tipo", "imovel", "property_type"]);
        const faixa_valor = pick(flat, ["faixa_valor", "valor", "budget", "orcamento", "orçamento", "price"]);
        const observacoes = pick(flat, ["observacoes", "observações", "message", "mensagem", "comments", "notes"]);
        const form_id = pick(flat, ["form_id", "formid", "form"]);
        const origem_in = pick(flat, ["origem", "source"]);

        // Captação de Corretores — campos específicos
        const ja_corretor = pick(flat, ["ja_corretor","já_corretor","ja corretor","já corretor","voce_ja_atua_como_corretor_de_imoveis","você já atua como corretor de imóveis","voce ja atua como corretor de imoveis","atua_como_corretor"]);
        const creci_ativo = pick(flat, ["creci_ativo","creci ativo","voce_possui_creci_ativo","você possui creci ativo","voce possui creci ativo","possui_creci"]);
        const numero_creci = pick(flat, ["numero_creci","número_creci","numero do creci","número do creci","creci","numero_do_creci_ativo","número do creci ativo"]);
        const disponibilidade_barra = pick(flat, ["disponibilidade_barra","disponibilidade barra","disponibilidade_para_atuar_na_barra_da_tijuca","disponibilidade para atuar na barra da tijuca","atuar_na_barra"]);
        const disponibilidade_recreio = pick(flat, ["disponibilidade_recreio","disponibilidade recreio","disponibilidade_para_atuar_no_recreio","disponibilidade para atuar no recreio","atuar_no_recreio"]);
        const disponibilidade_belford = pick(flat, ["disponibilidade_belford","disponibilidade belford","disponibilidade_para_atuar_em_belford_roxo","disponibilidade para atuar em belford roxo","atuar_em_belford"]);
        const disponibilidade_mesquita = pick(flat, ["disponibilidade_mesquita","disponibilidade mesquita","disponibilidade_para_atuar_em_mesquita_e_nilopolis","disponibilidade para atuar em mesquita e nilópolis","atuar_em_mesquita"]);
        const disponibilidade_video = pick(flat, ["disponibilidade_video","disponibilidade videochamada","disponibilidade_para_videochamada_diariamente","disponibilidade para videochamada diariamente","videochamada","video_diaria"]);
        const possui_veiculo = pick(flat, ["possui_veiculo","possui veículo","possui veiculo","possui_veiculo_para_locomocao","possui veículo para locomoção","possui veiculo para locomocao","veiculo","veículo"]);

        const isCaptacaoCorretor = !!(ja_corretor || creci_ativo || numero_creci || disponibilidade_barra || disponibilidade_recreio || disponibilidade_belford || disponibilidade_mesquita || disponibilidade_video || possui_veiculo);
        const dados_corretor = isCaptacaoCorretor ? {
          ja_corretor: ja_corretor ?? null,
          creci_ativo: creci_ativo ?? null,
          numero_creci: numero_creci ?? null,
          disponibilidade_barra: disponibilidade_barra ?? null,
          disponibilidade_recreio: disponibilidade_recreio ?? null,
          disponibilidade_belford: disponibilidade_belford ?? null,
          disponibilidade_mesquita: disponibilidade_mesquita ?? null,
          disponibilidade_video: disponibilidade_video ?? null,
          possui_veiculo: possui_veiculo ?? null,
        } : null;

        if (!telefone) {
          return new Response(JSON.stringify({ error: "Telefone obrigatório (campos aceitos: telefone, phone, celular, whatsapp)" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Tenta mapeamento por form_id primeiro
        let regiao: Regiao = "outras";
        let canal: "denise" | "fabiola" | "renata" | "robson" = "denise";
        let mappingFound = false;
        if (form_id) {
          const { data: mapping } = await supabaseAdmin
            .from("meta_form_mapping")
            .select("regiao, canal, ativo")
            .eq("form_id", form_id)
            .maybeSingle();
          if (mapping && mapping.ativo) {
            regiao = mapping.regiao as Regiao;
            canal = mapping.canal as typeof canal;
            mappingFound = true;
          }
        }
        if (!mappingFound) {
          if (isCaptacaoCorretor) {
            // mapeamento por campo de disponibilidade
            if (disponibilidade_recreio) { regiao = "recreio"; canal = "fabiola"; }
            else if (disponibilidade_belford) { regiao = "belford_roxo"; canal = "renata"; }
            else if (disponibilidade_mesquita) { regiao = "mesquita"; canal = "denise"; }
            else { regiao = "barra_da_tijuca"; canal = "robson"; }
          } else {
            regiao = detectRegiao(regiaoStr);
            canal = MAPA[regiao];
          }
        }

        const { data: responsavel } = await supabaseAdmin
          .from("responsaveis").select("id, whatsapp, nome, onesignal_external_id").eq("canal", canal).maybeSingle();

        const { data: lead, error } = await supabaseAdmin.from("leads").insert({
          nome,
          telefone: telefone.replace(/\D/g, ""),
          email: email ?? null,
          is_corretor: isCaptacaoCorretor,
          regiao,
          tipo_imovel: tipo_imovel ?? null,
          faixa_valor: faixa_valor ?? null,
          observacoes: observacoes ?? null,
          canal,
          responsavel_id: responsavel?.id ?? null,
          origem: origem_in ?? (isCaptacaoCorretor ? "captacao_corretores" : (form_id ? "meta_ads" : "webhook")),
          dados_corretor,
        }).select("id").single();

        if (error || !lead) {
          return new Response(JSON.stringify({ error: error?.message ?? "Erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        {
          const { sendOneSignalPush } = await import("@/lib/onesignal.server");
          const regiaoLabel = regiao.replace(/_/g, " ");
          const title = "Novo Lead chegou!";
          const responsavelNome = responsavel?.nome ?? "Não atribuído";
          const message = `Nome: ${nome} | Tel: ${telefone} | Região: ${regiaoLabel} | Responsável: ${responsavelNome}`;
          const url = `${new URL(request.url).origin}/leads?lead=${lead.id}`;
          const data = { lead_id: lead.id, regiao, canal, is_corretor: isCaptacaoCorretor };

          // Envia SEMPRE para o responsável + todos os admins simultaneamente
          const { data: adminRoles } = await supabaseAdmin
            .from("user_roles").select("user_id").eq("role", "admin");
          const adminIds = (adminRoles ?? []).map((r) => r.user_id);
          const { data: adminProfiles } = adminIds.length
            ? await supabaseAdmin
              .from("profiles")
              .select("id, onesignal_external_id, responsavel_id, responsaveis:responsavel_id(onesignal_external_id)")
              .in("id", adminIds)
            : { data: [] as { id: string; onesignal_external_id: string | null; responsavel_id: string | null; responsaveis: { onesignal_external_id: string | null } | null }[] };

          const responsavelExternalId = responsavel?.onesignal_external_id ?? null;
          const adminExternalIds = (adminProfiles ?? []).flatMap((p) => {
            const resp = p.responsaveis as { onesignal_external_id: string | null } | null;
            return [p.onesignal_external_id, resp?.onesignal_external_id].filter((x): x is string => !!x);
          });

          const externalIds = Array.from(new Set([
            ...(responsavelExternalId ? [responsavelExternalId] : []),
            ...adminExternalIds,
          ]));

          console.info("[Webhook OneSignal] Lead recebido", {
            leadId: lead.id,
            canal,
            regiao,
            responsavelEncontrado: !!responsavel,
            responsavel: responsavel ? { id: responsavel.id, nome: responsavel.nome } : null,
            responsavelExternalIdEncontrado: !!responsavelExternalId,
            adminsEncontrados: adminIds.length,
            adminExternalIdsEncontrados: adminExternalIds.length,
            externalIds,
            env: {
              hasOneSignalAppId: !!process.env.ONESIGNAL_APP_ID,
              hasOneSignalRestApiKey: !!process.env.ONESIGNAL_REST_API_KEY,
            },
          });

          const result = externalIds.length
            ? await sendOneSignalPush({ externalIds, title, message, url, data })
            : { ok: false, error: "Nenhum destinatário" } as { ok: boolean; resp?: unknown; error?: string };

          console.info("[Webhook OneSignal] Resultado do envio", {
            leadId: lead.id,
            ok: result.ok,
            error: result.error ?? null,
            response: result.resp ?? null,
          });

          const destino = [
            responsavelExternalId ? `responsavel:${responsavelExternalId}` : null,
            adminExternalIds.length ? `admins:${adminExternalIds.length}` : null,
          ].filter(Boolean).join(",");

          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id,
            tipo: "push_novo_lead",
            destino: destino || "",
            status: result.ok ? "enviado" : "falha",
            payload: { title, message, url, externalIds } as never,
            resposta: (result.resp ?? { error: result.error }) as never,
          });
        }

        return new Response(JSON.stringify({ ok: true, id: lead.id, regiao, canal }), {
          status: 201, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
