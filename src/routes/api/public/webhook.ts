import { createFileRoute } from "@tanstack/react-router";
import { normalizeOrigem, shouldUsePlantao } from "@/lib/plantao-shared";


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

        // === Evolution API (WhatsApp da empresa) ===
        // Eventos messages.upsert chegam com { event, instance, data: { key, pushName, message, ... } }
        const evolutionResp = await tryHandleEvolution(body);
        if (evolutionResp) return evolutionResp;

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

        // === Roteamento Plantão vs Região-fixa ===
        // Captação de corretor sempre segue fluxo antigo (não é "lead de venda").
        const origem = normalizeOrigem(origem_in);
        const usePlantao = !isCaptacaoCorretor && shouldUsePlantao(origem, regiao);

        if (usePlantao) {
          // ----- Fluxo Plantão: grava em vendas_leads -----
          const hoje = new Date().toISOString().slice(0, 10);
          const { data: escala } = await supabaseAdmin
            .from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
          const plantonista = (escala as { corretor_id: string } | null)?.corretor_id ?? null;

          const { data: vlead, error: vlErr } = await supabaseAdmin
            .from("vendas_leads").insert({
              nome,
              telefone: telefone.replace(/\D/g, ""),
              email: email ?? null,
              regiao: regiao as never,
              etapa: "novo" as never,
              observacoes: observacoes ?? null,
              origem,
              origem_detalhe: form_id ?? null,
              ultima_mensagem_em: new Date().toISOString(),
              plantao_dia: hoje,
              corretor_id: plantonista,
              atribuicao_status: plantonista ? "pendente" : null,
              atribuido_em: plantonista ? new Date().toISOString() : null,
            } as never).select("id").single();
          if (vlErr || !vlead) {
            return new Response(JSON.stringify({ error: vlErr?.message ?? "Erro" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          await supabaseAdmin.from("plantao_log" as never).insert({
            lead_id: vlead.id, corretor_id: plantonista,
            motivo: plantonista ? "novo_lead" : "sem_plantonista",
            origem, detalhe: { telefone, regiao, form_id: form_id ?? null } as never,
          } as never);

          // Push direcionado ao plantonista (ou admins se sem escala)
          try {
            const { sendOneSignalPush } = await import("@/lib/onesignal.server");
            if (plantonista) {
              const { data: prof } = await supabaseAdmin
                .from("profiles").select("onesignal_external_id").eq("id", plantonista).maybeSingle();
              const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
              if (ext) {
                await sendOneSignalPush({
                  externalId: ext,
                  title: "🏠 Novo lead de plantão",
                  message: `${nome} · ${telefone} · ${origem.replace(/_/g, " ")}`,
                  url: "https://sistemanexus.app/vendas/leads",
                  data: { lead_id: vlead.id, origem },
                });
              }
            } else {
              const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
              const ids = ((roles ?? []) as { user_id: string }[]).map((r) => r.user_id);
              if (ids.length) {
                const { data: profs } = await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", ids);
                const ext = ((profs ?? []) as { onesignal_external_id: string | null }[])
                  .map((p) => p.onesignal_external_id).filter((x): x is string => !!x);
                if (ext.length) {
                  await sendOneSignalPush({
                    externalIds: ext,
                    title: "⚠️ Lead sem plantonista",
                    message: `${nome} · ${telefone} · ${origem.replace(/_/g, " ")} — escale alguém no Plantão`,
                    url: "https://sistemanexus.app/vendas/plantao",
                    data: { lead_id: vlead.id },
                  });
                }
              }
            }
          } catch (e) { console.warn("[webhook plantão] push falhou", e); }

          return new Response(JSON.stringify({ ok: true, id: vlead.id, fluxo: "plantao", plantonista }), {
            status: 201, headers: { "Content-Type": "application/json" },
          });
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
          const message = `Nome: ${nome} | Tel: ${telefone} | Região: ${regiaoLabel}`;
          const url = `https://sistemanexus.app/leads/${lead.id}`;
          const data = { lead_id: lead.id, regiao, canal, is_corretor: isCaptacaoCorretor };

          // Responsável do form/canal recebe individualmente
          const responsavelExternalId = responsavel?.onesignal_external_id ?? null;

          // Admins recebem TODOS os leads
          const { data: adminRoles } = await supabaseAdmin
            .from("user_roles").select("user_id").eq("role", "admin");
          const adminIds = (adminRoles ?? []).map((r) => r.user_id);
          const { data: adminProfiles } = adminIds.length
            ? await supabaseAdmin
              .from("profiles")
              .select("id, onesignal_external_id, responsavel_id, responsaveis:responsavel_id(onesignal_external_id)")
              .in("id", adminIds)
            : { data: [] as { id: string; onesignal_external_id: string | null; responsavel_id: string | null; responsaveis: { onesignal_external_id: string | null } | null }[] };

          const adminExternalIds = (adminProfiles ?? []).flatMap((p) => {
            const resp = p.responsaveis as { onesignal_external_id: string | null } | null;
            return [p.onesignal_external_id, resp?.onesignal_external_id].filter((x): x is string => !!x);
          });

          const externalIds = Array.from(new Set([
            ...(responsavelExternalId ? [responsavelExternalId] : []),
            ...adminExternalIds,
          ]));

          const useFallback = !responsavelExternalId;

          console.info("[Webhook OneSignal] Lead recebido", {
            leadId: lead.id, canal, regiao, form_id,
            responsavel: responsavel ? { id: responsavel.id, nome: responsavel.nome } : null,
            responsavelExternalId,
            adminsCount: adminIds.length,
            adminExternalIds,
            externalIds,
            useFallback,
            fallbackReason: useFallback ? `Responsável '${canal}' sem onesignal_external_id cadastrado` : null,
          });

          let result: { ok: boolean; resp?: unknown; error?: string };
          if (useFallback) {
            // Fallback: garante entrega via segmento 'All' quando o responsável ainda não ativou push
            result = await sendOneSignalPush({ segments: ["All"], title, message, url, data });
          } else if (externalIds.length) {
            result = await sendOneSignalPush({ externalIds, title, message, url, data });
          } else {
            result = { ok: false, error: "Nenhum destinatário" };
          }

          console.info("[Webhook OneSignal] Resultado do envio", {
            leadId: lead.id,
            tentouEnviarPara: useFallback ? "segment:All (fallback)" : `externalIds:${externalIds.join(",")}`,
            ok: result.ok,
            error: result.error ?? null,
            response: result.resp ?? null,
          });

          const destino = useFallback
            ? `fallback:segment:All (responsavel ${canal} sem external_id)`
            : ([
                responsavelExternalId ? `responsavel:${responsavelExternalId}` : null,
                adminExternalIds.length ? `admins:${adminExternalIds.length}` : null,
              ].filter(Boolean).join(",") || "nenhum");

          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id,
            tipo: "push_novo_lead",
            destino,
            status: result.ok ? "enviado" : "falha",
            payload: { title, message, url, externalIds, useFallback } as never,
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

// ============================================================
// Evolution API (WhatsApp da empresa) — formato MESSAGES_UPSERT
// ============================================================

type EvoData = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string };
    audioMessage?: unknown;
  };
  messageType?: string;
  messageTimestamp?: number | string;
};

function extractEvolutionData(body: Record<string, unknown>): EvoData | null {
  const event = String(body.event ?? "").toLowerCase().replace(/[._-]/g, "");
  const data = (body.data ?? null) as EvoData | null;
  const hasShape = !!data && !!data.key && typeof data.key.remoteJid === "string";
  if (!hasShape) return null;
  // aceita messages.upsert / MESSAGES_UPSERT / sem event explícito mas com shape
  if (event && !event.includes("messagesupsert") && !event.includes("message")) return null;
  return data;
}

function extractEvolutionText(msg: EvoData["message"] | undefined): string {
  if (!msg) return "";
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    (msg.audioMessage ? "[áudio]" : "")
  ) || "";
}

function jidToPhone(jid: string | undefined): string {
  if (!jid) return "";
  // 5521999998888@s.whatsapp.net -> 5521999998888
  return jid.split("@")[0]!.replace(/\D/g, "");
}

async function tryHandleEvolution(body: Record<string, unknown>): Promise<Response | null> {
  const evo = extractEvolutionData(body);
  if (!evo) return null;

  const jid = evo.key?.remoteJid ?? "";
  // Ignora grupos e mensagens enviadas por nós
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) {
    return new Response(JSON.stringify({ ok: true, ignored: "grupo/broadcast" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  if (evo.key?.fromMe) {
    return new Response(JSON.stringify({ ok: true, ignored: "fromMe" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const telefone = jidToPhone(jid);
  if (!telefone) {
    return new Response(JSON.stringify({ error: "remoteJid sem telefone" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const nome = (evo.pushName && evo.pushName.trim()) || "Contato WhatsApp";
  const mensagem = extractEvolutionText(evo.message);
  const origem = "whatsapp_empresa" as const;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: escala } = await supabaseAdmin
    .from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
  const plantonista = (escala as { corretor_id: string } | null)?.corretor_id ?? null;

  const { data: existing } = await supabaseAdmin
    .from("vendas_leads")
    .select("id, corretor_id, atribuicao_status")
    .eq("telefone", telefone)
    .order("created_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const cur = existing as { id: string; corretor_id: string | null; atribuicao_status: string | null };
    const updates: Record<string, unknown> = { ultima_mensagem_em: new Date().toISOString() };
    let reassigned = false;
    if (plantonista && plantonista !== cur.corretor_id) {
      updates.corretor_id = plantonista;
      updates.atribuicao_status = "pendente";
      updates.atribuido_em = new Date().toISOString();
      updates.plantao_dia = hoje;
      reassigned = true;
    }
    await supabaseAdmin.from("vendas_leads").update(updates as never).eq("id", cur.id);
    await supabaseAdmin.from("plantao_log" as never).insert({
      lead_id: cur.id, corretor_id: plantonista,
      motivo: reassigned ? "reincidencia" : "mensagem",
      origem, detalhe: { telefone, anterior: cur.corretor_id, mensagem: mensagem.slice(0, 200), fonte: "evolution" } as never,
    } as never);
    if (reassigned && plantonista) {
      await evoNotifyPlantonista({ supabaseAdmin, corretorId: plantonista, leadId: cur.id, nome, telefone, mensagem, isReassign: true });
    }
    return new Response(JSON.stringify({ ok: true, id: cur.id, fluxo: "evolution", reassigned }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const insert = {
    nome, telefone, etapa: "novo",
    origem, origem_detalhe: "evolution_api",
    observacoes: mensagem ? `Primeira mensagem: ${mensagem.slice(0, 500)}` : null,
    ultima_mensagem_em: new Date().toISOString(),
    plantao_dia: hoje,
    corretor_id: plantonista,
    atribuicao_status: plantonista ? "pendente" : null,
    atribuido_em: plantonista ? new Date().toISOString() : null,
  } as never;
  const { data: novo, error } = await supabaseAdmin.from("vendas_leads").insert(insert).select("id").single();
  if (error || !novo) {
    return new Response(JSON.stringify({ error: error?.message ?? "Erro ao criar lead" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  await supabaseAdmin.from("plantao_log" as never).insert({
    lead_id: novo.id, corretor_id: plantonista,
    motivo: plantonista ? "novo_lead" : "sem_plantonista",
    origem, detalhe: { telefone, mensagem: mensagem.slice(0, 200), fonte: "evolution" } as never,
  } as never);
  if (plantonista) {
    await evoNotifyPlantonista({ supabaseAdmin, corretorId: plantonista, leadId: novo.id, nome, telefone, mensagem, isReassign: false });
  } else {
    await evoNotifyAdmins({ supabaseAdmin, leadId: novo.id, nome, telefone });
  }
  return new Response(JSON.stringify({ ok: true, id: novo.id, fluxo: "evolution", plantonista }), {
    status: 201, headers: { "Content-Type": "application/json" },
  });
}

async function evoNotifyPlantonista(args: { supabaseAdmin: any; corretorId: string; leadId: string; nome: string; telefone: string; mensagem: string; isReassign: boolean }) {
  try {
    const { data: prof } = await args.supabaseAdmin
      .from("profiles").select("onesignal_external_id").eq("id", args.corretorId).maybeSingle();
    const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
    if (!ext) return;
    const { sendOneSignalPush } = await import("@/lib/onesignal.server");
    const preview = args.mensagem ? ` — "${args.mensagem.slice(0, 60)}"` : "";
    await sendOneSignalPush({
      externalId: ext,
      title: args.isReassign ? "🔁 WhatsApp reatribuído" : "💬 Novo WhatsApp da empresa",
      message: `${args.nome} · ${args.telefone}${preview}`,
      url: "https://sistemanexus.app/vendas/leads",
      data: { lead_id: args.leadId, origem: "whatsapp_empresa" },
    });
  } catch (e) { console.warn("[webhook evolution] push falhou", e); }
}

async function evoNotifyAdmins(args: { supabaseAdmin: any; leadId: string; nome: string; telefone: string }) {
  try {
    const { data: roles } = await args.supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = ((roles ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (!ids.length) return;
    const { data: profs } = await args.supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", ids);
    const ext = ((profs ?? []) as { onesignal_external_id: string | null }[])
      .map((p) => p.onesignal_external_id).filter((x): x is string => !!x);
    if (!ext.length) return;
    const { sendOneSignalPush } = await import("@/lib/onesignal.server");
    await sendOneSignalPush({
      externalIds: ext,
      title: "⚠️ WhatsApp sem plantonista",
      message: `${args.nome} · ${args.telefone} — escale alguém no Plantão`,
      url: "https://sistemanexus.app/vendas/plantao",
      data: { lead_id: args.leadId },
    });
  } catch (e) { console.warn("[webhook evolution] push admin falhou", e); }
}
