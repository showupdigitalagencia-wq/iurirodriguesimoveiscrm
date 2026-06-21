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
    latitude?: number | null;
    longitude?: number | null;
    coords_source?: "embed" | "geocode" | null;
    map_query?: string | null;
  };
};

/**
 * Procura coordenadas no HTML — primeiro em iframes / scripts de Google Maps,
 * depois em padrões comuns (LatLng(lat,lng), data-lat/data-lng, etc.).
 * Retorna { lat, lng, query? } — query é o texto do parâmetro q= quando o embed
 * usa endereço em vez de coordenadas, útil para geocodificar depois.
 */
function extractMapCoords(html: string): { lat: number | null; lng: number | null; query: string | null } {
  // 1) iframe Google Maps — captura todos os src de maps
  const iframeSrcs = Array.from(
    html.matchAll(/<iframe[^>]+src=["']([^"']*(?:google\.com\/maps|maps\.google\.[a-z.]+)[^"']*)["']/gi)
  ).map((m) => m[1]);

  let query: string | null = null;
  for (const src of iframeSrcs) {
    // a) embed novo: !2d<lng>!3d<lat>
    const m1 = src.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
    if (m1) return { lng: Number(m1[1]), lat: Number(m1[2]), query: null };
    // b) center=lat,lng / ll=lat,lng / @lat,lng
    const m2 = src.match(/[?&](?:center|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m2) return { lat: Number(m2[1]), lng: Number(m2[2]), query: null };
    const m3 = src.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m3) return { lat: Number(m3[1]), lng: Number(m3[2]), query: null };
    // c) q=lat,lng
    const mq = src.match(/[?&]q=([^&]+)/);
    if (mq) {
      const raw = decodeURIComponent(mq[1].replace(/\+/g, " "));
      const mll = raw.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
      if (mll) return { lat: Number(mll[1]), lng: Number(mll[2]), query: null };
      // texto (endereço) — guarda para geocodificar
      if (!query) query = raw.trim();
    }
  }

  // 2) padrões em scripts / data-attributes
  const patterns: RegExp[] = [
    /LatLng\(\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\)/,
    /data-lat=["'](-?\d+\.\d+)["'][^>]*data-(?:lng|lon|long)=["'](-?\d+\.\d+)["']/,
    /"lat(?:itude)?"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng|"longitude"\s*:\s*(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]), query };
  }

  return { lat: null, lng: null, query };
}

/** Geocodifica endereço via Google Maps connector (se conectado). */
async function geocodeViaGoogle(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmKey) return null;
  try {
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
      },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
    };
    const loc = j.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (e) {
    console.warn("[importImovel] geocode falhou", e);
  }
  return null;
}

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

/**
 * Quando as fotos estão num CDN com pasta por imóvel (ex.: voaimgs.com.br/.../imoveis/<id>/...),
 * agrupa pela pasta mais frequente — é o sinal mais forte de "fotos deste anúncio"
 * e elimina imagens de outros imóveis listados na mesma página.
 */
function groupByImovelFolder(allImgs: string[]): string[] {
  const folderCount = new Map<string, number>();
  const byFolder = new Map<string, string[]>();
  for (const u of allImgs) {
    const m = u.match(/(\/imoveis\/[^/]+\/)/i);
    if (!m) continue;
    const key = m[1];
    folderCount.set(key, (folderCount.get(key) ?? 0) + 1);
    const arr = byFolder.get(key) ?? [];
    arr.push(u);
    byFolder.set(key, arr);
  }
  if (folderCount.size === 0) return allImgs;
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of folderCount) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best ? (byFolder.get(best) ?? allImgs) : allImgs;
}

function selectRelevantImages(allImgs: string[], ogImage: string | null): string[] {
  const folderImgs = groupByImovelFolder(allImgs);
  const folderSet = new Set(folderImgs);
  const nonFolderImgs = allImgs.filter((u) => !u.match(/\/imoveis\/[^/]+\//i));
  const sameAdUploadImgs = filterRelevantImages(nonFolderImgs, ogImage);

  const merged =
    folderImgs.length && folderImgs.length !== allImgs.length
      ? [...folderImgs, ...sameAdUploadImgs]
      : filterRelevantImages(allImgs, ogImage);

  return Array.from(new Set(merged.filter((u) => folderSet.has(u) || allImgs.includes(u))));
}

function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack, cause: err.cause };
  }
  return { value: String(err) };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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
    // Cobre fotos no domínio da própria imobiliária (/upload/imoveis/...) E no CDN
    // do Voa Corretor (img.voaimgs.com.br/.../imoveis/<id>/...). Sem o CDN, só a
    // capa era capturada e a galeria inteira do anúncio ficava de fora.
    const imgRegex =
      /https?:\/\/[^\s"'>]+\/(?:upload\/)?imoveis\/[^\s"'>]+\.(?:jpe?g|png|webp)/gi;
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
    // Quando há pasta por imóvel no CDN, agrupa por ela; caso contrário, cai no
    // filtro antigo pelo prefixo do og:image.
    const grouped = groupByImovelFolder(allImgs);
    const remoteFotos =
      grouped.length && grouped.length !== allImgs.length
        ? grouped
        : filterRelevantImages(allImgs, ogImage);


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

    // ---------- COORDENADAS (mapa embed ou geocode) ----------
    const coordsHit = extractMapCoords(html);
    let latitude: number | null = coordsHit.lat;
    let longitude: number | null = coordsHit.lng;
    let coords_source: "embed" | "geocode" | null =
      latitude != null && longitude != null ? "embed" : null;
    const mapQuery =
      coordsHit.query ??
      [bairro, cidade].filter(Boolean).join(", ") ??
      null;
    if (latitude == null && mapQuery) {
      const g = await geocodeViaGoogle(mapQuery);
      if (g) {
        latitude = g.lat;
        longitude = g.lng;
        coords_source = "geocode";
      }
    }

    const warnings: string[] = [];
    if (!anyExtracted) warnings.push("Não consegui extrair dados automaticamente — preencha manualmente.");
    if (downloadFailures > 0) {
      warnings.push(`${downloadFailures} foto(s) não puderam ser baixadas e foram mantidas como link externo.`);
    }
    if (latitude == null && mapQuery) {
      warnings.push(
        "Mapa do anúncio não tem coordenadas embutidas e o geocoder do Google não está conectado — coordenadas ficaram em branco."
      );
    }

    return {
      ok: !!anyExtracted,
      source: url,
      warning: warnings.length ? warnings.join(" ") : undefined,
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
        latitude,
        longitude,
        coords_source,
        map_query: mapQuery,
      },
    };
  });
