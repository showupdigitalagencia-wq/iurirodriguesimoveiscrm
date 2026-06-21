import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withWebhookLog } from "@/lib/webhook-log.server";


const LeadInput = z.object({
  nome: z.string().min(2).max(120),
  telefone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  is_corretor: z.boolean().optional().default(false),
  creci: z.string().max(40).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  regiao: z.enum([
    "barra_da_tijuca", "recreio", "belford_roxo", "nilopolis", "mesquita",
    "jacarepagua", "zona_sul", "zona_norte", "zona_oeste", "centro", "outras",
  ]),
  tipo_imovel: z.string().max(80).optional(),
  faixa_valor: z.string().max(80).optional(),
  observacoes: z.string().max(2000).optional(),
});

const MAPA: Record<string, "denise" | "fabiola" | "renata" | "robson"> = {
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

export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => withWebhookLog(request, async (request) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
        }
        const parsed = LeadInput.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Dados inválidos", issues: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const data = parsed.data;
        const canal = MAPA[data.regiao];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: responsavel } = await supabaseAdmin
          .from("responsaveis").select("id, whatsapp, nome").eq("canal", canal).maybeSingle();

        const { data: lead, error } = await supabaseAdmin.from("leads").insert({
          nome: data.nome, telefone: data.telefone.replace(/\D/g, ""),
          email: data.email ?? null, is_corretor: data.is_corretor ?? false,
          creci: data.creci ?? null, regiao: data.regiao,
          tipo_imovel: data.tipo_imovel ?? null, faixa_valor: data.faixa_valor ?? null,
          observacoes: data.observacoes ?? null, canal,
          responsavel_id: responsavel?.id ?? null, origem: "formulario_site",
        }).select("id").single();

        if (error || !lead) {
          return new Response(JSON.stringify({ error: error?.message ?? "Erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        if (responsavel?.whatsapp) {
          const { sendZapiMessage, formatLeadMessage } = await import("@/lib/notify.server");
          const msg = formatLeadMessage({ ...data, regiao: data.regiao.replace(/_/g, " ") });
          const result = await sendZapiMessage(responsavel.whatsapp, msg);
          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id, tipo: "whatsapp_novo_lead", destino: responsavel.whatsapp,
            status: result.ok ? "enviado" : "falha",
            payload: { message: msg },
            resposta: (result.resp ?? { error: result.error }) as never,
          });
        }

        return new Response(JSON.stringify({ ok: true, id: lead.id }), {
          status: 201, headers: { "Content-Type": "application/json" },
        });
      }, { fonteOverride: "site" }),

    },
  },
});
