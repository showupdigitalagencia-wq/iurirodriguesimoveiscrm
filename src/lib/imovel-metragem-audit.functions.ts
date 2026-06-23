import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runImovelImport } from "./imovel-import.functions";

export type MetragemAuditItem = {
  id: string;
  codigo: string | null;
  url: string;
  areaDb: number | null;
  areaParser: number | null;
  jsonLdValue: number | null;
  encontradoNoDescricao: number | null;
  encontradoNoCorpo: number | null;
  presenteNaPagina: boolean;
  trechos: string[];
  fontesTentadas: string[];
  conclusao:
    | "parser_capturou"
    | "ausente_na_vitrine"
    | "parser_perdeu_dado_presente"
    | "erro";
  erro?: string;
};

export type MetragemAuditReport = {
  total: number;
  capturadosAgora: number;
  ausentesNaVitrine: number;
  perdidosPeloParser: number;
  comErro: number;
  items: MetragemAuditItem[];
};

async function ensureAdmin(context: {
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>;
  userId: string;
}) {
  const { data } = await (context.supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: boolean | null }>)("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Apenas administradores podem auditar metragem.");
}

const AREA_REGEXES: RegExp[] = [
  /área\s*(?:[úu]til|privativa|constru[íi]da|total)?\s*(?:de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*m/gi,
  /(\d+(?:[.,]\d+)?)\s*m²/gi,
  /(\d+(?:[.,]\d+)?)\s*m2\b/gi,
];

function findAllAreaSnippets(text: string): { value: number | null; snippets: string[] } {
  const snippets: string[] = [];
  let firstValue: number | null = null;
  for (const re of AREA_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].replace(",", ".");
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (firstValue == null) firstValue = n;
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + m[0].length + 40);
      snippets.push(text.slice(start, end).trim());
      if (snippets.length >= 4) break;
    }
    if (snippets.length >= 4) break;
  }
  return { value: firstValue, snippets };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

function extractJsonLdArea(html: string): number | null {
  const blocks = Array.from(
    html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const fs = (item as { floorSize?: { value?: number } }).floorSize;
        const v = fs?.value;
        if (typeof v === "number" && v > 0) return v;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function extractMetaDescription(html: string): string {
  return (
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ?? ""
  );
}

function extractJsonLdDescription(html: string): string {
  const blocks = Array.from(
    html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        const d = (item as { description?: string })?.description;
        if (typeof d === "string" && d) return d;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export const auditarMetragemImoveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetragemAuditReport> => {
    await ensureAdmin(context as never);
    const { supabase } = context;

    const { data: imoveis, error } = await supabase
      .from("imoveis")
      .select("id, codigo, area_m2, vitrine_url")
      .not("vitrine_url", "is", null)
      .or("area_m2.is.null,area_m2.eq.0");
    if (error) throw error;

    const list = (imoveis ?? []) as Array<{
      id: string;
      codigo: string | null;
      area_m2: number | null;
      vitrine_url: string | null;
    }>;

    const items: MetragemAuditItem[] = [];
    for (const im of list) {
      const url = im.vitrine_url ?? "";
      const item: MetragemAuditItem = {
        id: im.id,
        codigo: im.codigo,
        url,
        areaDb: im.area_m2,
        areaParser: null,
        jsonLdValue: null,
        encontradoNoDescricao: null,
        encontradoNoCorpo: null,
        presenteNaPagina: false,
        trechos: [],
        fontesTentadas: ["JSON-LD floorSize", "descrição (JSON-LD/meta)", "corpo da página (HTML stripped)"],
        conclusao: "erro",
      };
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; NexusBot/1.0; +https://sistemanexus.app)",
            Accept: "text/html,application/xhtml+xml",
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();

        const jldArea = extractJsonLdArea(html);
        const descr = extractJsonLdDescription(html) || extractMetaDescription(html);
        const body = stripHtml(html);

        const descrHit = findAllAreaSnippets(descr);
        const bodyHit = findAllAreaSnippets(body);

        item.jsonLdValue = jldArea;
        item.encontradoNoDescricao = descrHit.value;
        item.encontradoNoCorpo = bodyHit.value;
        item.trechos = [...descrHit.snippets, ...bodyHit.snippets].slice(0, 4);
        item.presenteNaPagina =
          jldArea != null || descrHit.value != null || bodyHit.value != null;

        // roda o parser real para conferir
        const parsed = await runImovelImport(url, {
          skipFotoBaseStems: new Set(["__skip_all__"]),
        });
        item.areaParser = parsed.data.area_m2 ?? null;

        if (item.areaParser != null && item.areaParser > 0) {
          item.conclusao = "parser_capturou";
        } else if (!item.presenteNaPagina) {
          item.conclusao = "ausente_na_vitrine";
        } else {
          item.conclusao = "parser_perdeu_dado_presente";
        }
      } catch (e) {
        item.conclusao = "erro";
        item.erro = e instanceof Error ? e.message : String(e);
      }
      items.push(item);
    }

    return {
      total: items.length,
      capturadosAgora: items.filter((i) => i.conclusao === "parser_capturou").length,
      ausentesNaVitrine: items.filter((i) => i.conclusao === "ausente_na_vitrine").length,
      perdidosPeloParser: items.filter((i) => i.conclusao === "parser_perdeu_dado_presente").length,
      comErro: items.filter((i) => i.conclusao === "erro").length,
      items,
    };
  });
