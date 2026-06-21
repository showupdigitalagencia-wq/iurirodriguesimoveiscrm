import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImovelImportResult = {
  ok: boolean;
  source: string;
  warning?: string;
  data: {
    codigo?: string | null;
    tipo?: "apartamento" | "casa" | "comercial" | null;
    finalidade?: "locacao" | "venda" | "ambos" | null;
    status?: string | null;
    rua?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    valor_venda?: number | null;
    valor_aluguel?: number | null;
    condominio?: number | null;
    iptu?: number | null;
    quartos?: number | null;
    suites?: number | null;
    banheiros?: number | null;
    vagas?: number | null;
    area_m2?: number | null;
    descricao?: string | null;
    fotos: string[];
  };
};

function parseBRLToNumber(raw: string): number | null {
  // "1.500.000,00" or "464,81" → number
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  // Remove thousands dots, swap decimal comma
  const normalized = cleaned.replace(/\.(?=\d{3}(?:[,.]|$))/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumber(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function pickBRL(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  return parseBRLToNumber(m[1]);
}

function extractCodigoFromUrl(url: string): string | null {
  // .../AP0021 or .../AP0021-43
  const m = url.match(/\/([A-Z]{2}\d{3,6})(?:[-/?#].*)?$/i);
  return m ? m[1].toUpperCase() : null;
}

function inferTipoFromText(text: string): "apartamento" | "casa" | "comercial" | null {
  const t = text.toLowerCase();
  if (/apartamento|cobertura|flat|studio|kitnet/.test(t)) return "apartamento";
  if (/comercial|sala\s+comercial|loja|galpão|escritório/.test(t)) return "comercial";
  if (/casa|sobrado|chácara|sítio/.test(t)) return "casa";
  return null;
}

function inferFinalidade(text: string): "locacao" | "venda" | "ambos" | null {
  const t = text.toLowerCase();
  const venda = /\b(à\s*venda|a\s*venda|venda)\b/.test(t);
  const locacao = /\b(aluguel|locação|locacao|para\s+alugar|à\s*alugar|a\s*alugar)\b/.test(t);
  if (venda && locacao) return "ambos";
  if (venda) return "venda";
  if (locacao) return "locacao";
  return null;
}

/**
 * Filtra fotos pelo prefixo do nome do og:image, para evitar imagens de outros
 * imóveis ("relacionados") que aparecem na mesma página.
 */
function filterRelevantImages(allImgs: string[], ogImage: string | null): string[] {
  if (!ogImage) return allImgs;
  // og:image pode vir como wrapper (...thumb.php?w=600&img=https://.../arquivo.jpg)
  // Extrai o último nome de arquivo de imagem da string.
  const fileMatch = ogImage.match(/([^/?&=]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i);
  const base = fileMatch?.[1] ?? "";
  if (!base) return allImgs;
  const rootMatch = base.match(/^([a-z0-9-]+?)(\d{3,}|)(?:\.[a-z]+)?$/i);
  const root = rootMatch?.[1] ?? base.replace(/\.[a-z]+$/i, "");
  if (root.length < 12) return allImgs;
  const prefix = root.slice(0, Math.min(root.length, 35));
  const filtered = allImgs.filter((u) => {
    const fn = u.split("/").pop() ?? "";
    return fn.startsWith(prefix);
  });
  return filtered.length ? filtered : allImgs;
}

export const importImovelFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) =>
    z.object({ url: z.string().url() }).parse(input)
  )
  .handler(async ({ data }): Promise<ImovelImportResult> => {
    const url = data.url.trim();
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NexusBot/1.0; +https://sistemanexus.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Falha ao buscar página (HTTP ${res.status})`);
    }
    const html = await res.text();

    // ---------- META & OG ----------
    const ogImage =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      null;
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
    const metaDesc =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";

    // ---------- JSON-LD ----------
    type Jld = {
      "@type"?: string | string[];
      name?: string;
      description?: string;
      numberOfBedrooms?: number;
      numberOfBathroomsTotal?: number;
      numberOfRooms?: number;
      floorSize?: { value?: number; unitCode?: string };
      offers?: { price?: string | number; priceCurrency?: string };
      address?: { addressLocality?: string; addressRegion?: string; streetAddress?: string };
      image?: string | string[];
    };
    const jldMatches = Array.from(
      html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)
    );
    let jld: Jld | null = null;
    for (const m of jldMatches) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
          if (!item || typeof item !== "object") continue;
          const t = (item as Jld)["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (
            types.some(
              (x) =>
                typeof x === "string" &&
                /Apartment|House|SingleFamilyResidence|Residence|Place|Product/i.test(x)
            )
          ) {
            jld = item as Jld;
            break;
          }
        }
        if (jld) break;
      } catch {
        // ignore malformed JSON-LD blocks
      }
    }

    // ---------- IMAGES (download + upload to bucket "imoveis-fotos") ----------
    const imgRegex = /https?:\/\/[^\s"'>]+\/upload\/imoveis\/[^\s"'>]+\.(?:jpe?g|png|webp)/gi;
    const rawImgs = Array.from(new Set(html.match(imgRegex) ?? []));
    // Dedupe por nome de arquivo, preferindo URL direta (sem thumb.php)
    const byBasename = new Map<string, string>();
    for (const u of rawImgs) {
      const fn = u.split("/").pop() ?? u;
      const existing = byBasename.get(fn);
      if (!existing || (existing.includes("thumb.php") && !u.includes("thumb.php"))) {
        byBasename.set(fn, u);
      }
    }
    const allImgs = Array.from(byBasename.values());
    const remoteFotos = filterRelevantImages(allImgs, ogImage);

    // Baixa cada imagem e grava no bucket privado "imoveis-fotos".
    // Mantém URLs remotas como fallback se algum download falhar.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const folder = `import/${(extractCodigoFromUrl(url) ?? "voa").toLowerCase()}-${Date.now()}`;
    const fotos: string[] = [];
    let downloadFailures = 0;

    for (const imgUrl of remoteFotos) {
      try {
        const imgRes = await fetch(imgUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; NexusBot/1.0; +https://sistemanexus.app)",
            Referer: url,
          },
        });
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const contentType =
          imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        // Sanitiza nome e força extensão coerente com o content-type
        const extFromType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/jpg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const ext = extFromType[contentType] ?? "jpg";
        const baseName = (imgUrl.split("/").pop() ?? "foto")
          .replace(/\?.*$/, "")
          .replace(/\.[a-z]+$/i, "")
          .replace(/[^a-z0-9-_]/gi, "_")
          .slice(0, 60);
        const path = `${folder}/${String(fotos.length + 1).padStart(2, "0")}-${baseName}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("imoveis-fotos")
          .upload(path, bytes, { contentType, upsert: false });
        if (upErr) throw upErr;
        fotos.push(path);
      } catch (err) {
        console.warn("[importImovel] falha ao baixar foto", imgUrl, err);
        downloadFailures++;
        // fallback: mantém a URL remota para não perder a referência visual
        fotos.push(imgUrl);
      }
    }

    // ---------- TEXTO BASE ----------
    const descricao = jld?.description ?? metaDesc ?? "";
    const tituloBase = jld?.name ?? ogTitle ?? "";
    const fullText = `${tituloBase}\n${descricao}`;

    // ---------- CAMPOS ----------
    const codigo = extractCodigoFromUrl(url);

    const tipo = inferTipoFromText(tituloBase) ?? inferTipoFromText(descricao);
    const finalidade = inferFinalidade(tituloBase) ?? inferFinalidade(descricao);

    const quartos =
      jld?.numberOfBedrooms ?? pickFirstNumber(/(\d+)\s*quartos?/i, fullText);
    const banheiros =
      jld?.numberOfBathroomsTotal ?? pickFirstNumber(/(\d+)\s*banheiros?/i, fullText);
    const suites = pickFirstNumber(/(\d+)\s*su[íi]tes?/i, fullText);
    const vagas =
      pickFirstNumber(/(\d+)\s*vagas?\s+de\s+garagem/i, fullText) ??
      pickFirstNumber(/(\d+)\s*vagas?/i, fullText);
    const area_m2 =
      jld?.floorSize?.value ??
      pickFirstNumber(/área\s*(?:total)?\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*m/i, fullText) ??
      pickFirstNumber(/(\d+(?:[.,]\d+)?)\s*m²/i, fullText);

    // Valores monetários — tenta JSON-LD primeiro
    let valor_venda: number | null = null;
    let valor_aluguel: number | null = null;
    const offerPrice = jld?.offers?.price;
    if (offerPrice != null) {
      const v = typeof offerPrice === "string" ? Number(offerPrice) : offerPrice;
      if (Number.isFinite(v)) {
        if (finalidade === "locacao") valor_aluguel = v;
        else valor_venda = v;
      }
    }
    // Padrões textuais "Valor do imóvel" / "Valor de venda" / "Aluguel"
    if (valor_venda == null) {
      valor_venda =
        pickBRL(/(?:valor\s+do\s+im[óo]vel|valor\s+de\s+venda|pre[çc]o\s+de\s+venda|venda)[\s:\-—–]*R\$?\s*([\d.,]+)/i, fullText) ??
        null;
    }
    if (valor_aluguel == null) {
      valor_aluguel =
        pickBRL(/(?:aluguel|loca[çc][ãa]o|valor\s+do\s+aluguel)[\s:\-—–]*R\$?\s*([\d.,]+)/i, fullText) ??
        null;
    }
    const condominio = pickBRL(/condom[íi]nio[\s:\-—–]*R\$?\s*([\d.,]+)/i, fullText);
    const iptu = pickBRL(/iptu[\s:\-—–]*R\$?\s*([\d.,]+)/i, fullText);

    // Endereço (cidade / bairro)
    const cidade =
      jld?.address?.addressLocality ??
      fullText.match(/em\s+([A-ZÁÉÍÓÚÃÕÂÊÔÇ][a-zA-ZáéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ\s]+?),/)?.[1]?.trim() ??
      null;
    const bairro =
      fullText.match(/,\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇ][a-zA-ZáéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ\s]+?),\s*com/)?.[1]?.trim() ??
      fullText.match(/no\s+([A-ZÁÉÍÓÚÃÕÂÊÔÇ][a-zA-ZáéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ\s]+?)\./)?.[1]?.trim() ??
      null;

    const anyExtracted =
      tipo || finalidade || quartos != null || banheiros != null || valor_venda != null ||
      valor_aluguel != null || fotos.length > 0 || cidade || bairro;

    return {
      ok: !!anyExtracted,
      source: url,
      warning: !anyExtracted
        ? "Não consegui extrair dados automaticamente — preencha manualmente."
        : undefined,
      data: {
        codigo,
        tipo,
        finalidade,
        status:
          finalidade === "venda"
            ? "disponivel_venda"
            : finalidade === "locacao"
            ? "disponivel_locacao"
            : null,
        rua: null,
        bairro,
        cidade,
        valor_venda,
        valor_aluguel,
        condominio,
        iptu,
        quartos,
        suites,
        banheiros,
        vagas,
        area_m2,
        descricao: descricao || null,
        fotos,
      },
    };
  });
