import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runImovelImport, type ImovelImportResult } from "./imovel-import.functions";

export type ResyncFieldChange = {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
};


export type ResyncImovelReport = {
  id: string;
  codigo: string | null;
  url: string;
  ok: boolean;
  skipped?: string;
  error?: string;
  changes: ResyncFieldChange[];
  fotosAdicionadas: number;
  warning?: string;
};

export type ResyncBatchReport = {
  total: number;
  atualizados: number;
  semMudanca: number;
  pulados: number;
  comErro: number;
  items: ResyncImovelReport[];
};

/**
 * Extrai o "baseName sanitizado" usado pelo importador a partir de um path
 * armazenado no bucket (ex.: "import/ap0021-1234/01-flat-para-alugar.jpg" →
 * "flat-para-alugar"). Permite comparar com novos URLs remotos para evitar
 * re-baixar fotos já existentes.
 */
function existingPhotoBaseStem(path: string): string | null {
  const fn = path.split("/").pop();
  if (!fn) return null;
  // remove extensão e prefixo NN- (índice)
  const noExt = fn.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/^\d+-/, "");
}

/**
 * Campos que o parser controla e podemos sobrescrever quando reextraídos.
 * Mantemos preservados: captador_id, gestao_patrimonio, codigo (manual override),
 * chave_*, proprietario_*, locatario_*, numero, rua, dia_vencimento, vitrine_url,
 * valor_venda, valor_aluguel, condominio, iptu (preço pode ter ajuste manual).
 *
 * Estratégia por campo:
 *  - "overwrite-if-parser-has-value": atualiza só quando parser trouxe valor > 0
 *    (foi exatamente o bug — sobrescrever zerados/errados pelo correto).
 *  - "fill-if-empty": só preenche quando o atual está vazio (para descrição /
 *    bairro / cidade / coords / status, que o usuário pode ter ajustado).
 */
const OVERWRITE_FIELDS = ["quartos", "suites", "banheiros", "vagas", "area_m2"] as const;
const FILL_IF_EMPTY = ["tipo", "finalidade", "status", "bairro", "cidade", "latitude", "longitude"] as const;

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && v === 0);
}

async function applyResync(
  imovel: Record<string, unknown> & { id: string; fotos?: string[] | null; vitrine_url?: string | null },
  result: ImovelImportResult,
  supabase: { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } } }
): Promise<ResyncImovelReport> {
  const changes: ResyncFieldChange[] = [];
  const update: Record<string, unknown> = {};
  const d = result.data as unknown as Record<string, unknown>;

  const asScalar = (v: unknown): string | number | null => {
    if (v == null) return null;
    if (typeof v === "number" || typeof v === "string") return v;
    return String(v);
  };

  for (const field of OVERWRITE_FIELDS) {
    const newV = d[field];
    if (typeof newV === "number" && Number.isFinite(newV) && newV > 0 && imovel[field] !== newV) {
      update[field] = newV;
      changes.push({ field, oldValue: asScalar(imovel[field]), newValue: newV });
    }
  }
  for (const field of FILL_IF_EMPTY) {
    const newV = d[field];
    if (newV != null && newV !== "" && isEmpty(imovel[field])) {
      update[field] = newV;
      changes.push({ field, oldValue: asScalar(imovel[field]), newValue: asScalar(newV) });
    }
  }
  // descrição → grava em "observacoes" se vazio (mesmo destino do importador original)
  if (typeof d.descricao === "string" && d.descricao && isEmpty(imovel.observacoes)) {
    update.observacoes = d.descricao;
    changes.push({ field: "observacoes", oldValue: asScalar(imovel.observacoes), newValue: d.descricao });
  }


  // Fotos: anexa as novas (já filtradas pelo skipStems no runImovelImport)
  const novasFotos = (result.data.fotos ?? []).filter((p) => !(imovel.fotos ?? []).includes(p));
  if (novasFotos.length) {
    update.fotos = [...(imovel.fotos ?? []), ...novasFotos];
    changes.push({ field: "fotos", oldValue: `${(imovel.fotos ?? []).length} foto(s)`, newValue: `+${novasFotos.length}` });
  }

  if (Object.keys(update).length === 0) {
    return {
      id: imovel.id,
      codigo: (imovel.codigo as string | null) ?? null,
      url: imovel.vitrine_url ?? "",
      ok: true,
      changes: [],
      fotosAdicionadas: 0,
      warning: result.warning,
    };
  }

  const { error } = await supabase.from("imoveis").update(update).eq("id", imovel.id);
  if (error) {
    return {
      id: imovel.id,
      codigo: (imovel.codigo as string | null) ?? null,
      url: imovel.vitrine_url ?? "",
      ok: false,
      error: error.message,
      changes,
      fotosAdicionadas: novasFotos.length,
    };
  }

  return {
    id: imovel.id,
    codigo: (imovel.codigo as string | null) ?? null,
    url: imovel.vitrine_url ?? "",
    ok: true,
    changes,
    fotosAdicionadas: novasFotos.length,
    warning: result.warning,
  };
}

async function ensureAdmin(context: { supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores podem re-sincronizar imóveis.");
}

export const resyncImovelFromSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResyncImovelReport> => {
    await ensureAdmin(context as never);
    const { supabase } = context;
    const { data: imovel, error } = await supabase
      .from("imoveis")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!imovel) throw new Error("Imóvel não encontrado.");
    const url = (imovel as { vitrine_url?: string | null }).vitrine_url;
    if (!url) {
      return {
        id: data.id,
        codigo: (imovel as { codigo?: string | null }).codigo ?? null,
        url: "",
        ok: false,
        skipped: "Imóvel sem URL de origem (vitrine_url). Use 'Importar do site' para vincular.",
        changes: [],
        fotosAdicionadas: 0,
      };
    }
    const skipStems = new Set<string>();
    for (const f of (imovel as { fotos?: string[] | null }).fotos ?? []) {
      const s = existingPhotoBaseStem(f);
      if (s) skipStems.add(s);
    }
    const result = await runImovelImport(url, { skipFotoBaseStems: skipStems });
    return applyResync(imovel as never, result, supabase as never);
  });

export const resyncTodosImoveisDoSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResyncBatchReport> => {
    await ensureAdmin(context as never);
    const { supabase } = context;
    const { data: imoveis, error } = await supabase
      .from("imoveis")
      .select("*")
      .not("vitrine_url", "is", null);
    if (error) throw error;
    const list = (imoveis ?? []) as Array<Record<string, unknown> & { id: string; fotos?: string[] | null; vitrine_url?: string | null }>;

    const items: ResyncImovelReport[] = [];
    for (const im of list) {
      try {
        const skipStems = new Set<string>();
        for (const f of im.fotos ?? []) {
          const s = existingPhotoBaseStem(f);
          if (s) skipStems.add(s);
        }
        const result = await runImovelImport(im.vitrine_url ?? "", { skipFotoBaseStems: skipStems });
        const rep = await applyResync(im, result, supabase as never);
        items.push(rep);
      } catch (e) {
        items.push({
          id: im.id,
          codigo: (im.codigo as string | null) ?? null,
          url: im.vitrine_url ?? "",
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          changes: [],
          fotosAdicionadas: 0,
        });
      }
    }

    return {
      total: items.length,
      atualizados: items.filter((i) => i.ok && i.changes.length > 0).length,
      semMudanca: items.filter((i) => i.ok && i.changes.length === 0 && !i.skipped).length,
      pulados: items.filter((i) => !!i.skipped).length,
      comErro: items.filter((i) => !i.ok && !i.skipped).length,
      items,
    };
  });
