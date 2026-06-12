import { createFileRoute } from "@tanstack/react-router";

type Regiao = "barra_da_tijuca" | "recreio" | "jacarepagua" | "zona_sul" | "zona_norte" | "zona_oeste" | "centro" | "outras";

const MAPA: Record<Regiao, "denise" | "fabiola" | "renata" | "robson"> = {
  barra_da_tijuca: "denise", recreio: "fabiola", jacarepagua: "renata",
  zona_sul: "denise", zona_norte: "robson", zona_oeste: "fabiola",
  centro: "robson", outras: "denise",
};

const REGIOES: Regiao[] = ["barra_da_tijuca", "recreio", "jacarepagua", "zona_sul", "zona_norte", "zona_oeste", "centro", "outras"];

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
        const disponibilidade_video = pick(flat, ["disponibilidade_video","disponibilidade videochamada","disponibilidade_para_videochamada_diariamente","disponibilidade para videochamada diariamente","videochamada","video_diaria"]);
        const possui_veiculo = pick(flat, ["possui_veiculo","possui veículo","possui veiculo","possui_veiculo_para_locomocao","possui veículo para locomoção","possui veiculo para locomocao","veiculo","veículo"]);

        const isCaptacaoCorretor = !!(ja_corretor || creci_ativo || numero_creci || disponibilidade_barra || disponibilidade_video || possui_veiculo);
        const dados_corretor = isCaptacaoCorretor ? {
          ja_corretor: ja_corretor ?? null,
          creci_ativo: creci_ativo ?? null,
          numero_creci: numero_creci ?? null,
          disponibilidade_barra: disponibilidade_barra ?? null,
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
          regiao = detectRegiao(regiaoStr);
          canal = MAPA[regiao];
        }

        const { data: responsavel } = await supabaseAdmin
          .from("responsaveis").select("id, whatsapp, nome").eq("canal", canal).maybeSingle();

        const { data: lead, error } = await supabaseAdmin.from("leads").insert({
          nome,
          telefone: telefone.replace(/\D/g, ""),
          email: email ?? null,
          is_corretor: false,
          regiao,
          tipo_imovel: tipo_imovel ?? null,
          faixa_valor: faixa_valor ?? null,
          observacoes: observacoes ?? null,
          canal,
          responsavel_id: responsavel?.id ?? null,
          origem: origem_in ?? (form_id ? "meta_ads" : "webhook"),
        }).select("id").single();

        if (error || !lead) {
          return new Response(JSON.stringify({ error: error?.message ?? "Erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        if (responsavel?.whatsapp) {
          const { sendZapiMessage, formatLeadMessage } = await import("@/lib/notify.server");
          const msg = formatLeadMessage({
            nome, telefone, email,
            regiao: regiao.replace(/_/g, " "),
            tipo_imovel, faixa_valor, observacoes,
          });
          const result = await sendZapiMessage(responsavel.whatsapp, msg);
          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id, tipo: "whatsapp_novo_lead", destino: responsavel.whatsapp,
            status: result.ok ? "enviado" : "falha",
            payload: { message: msg },
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
