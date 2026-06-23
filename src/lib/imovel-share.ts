// Helpers para montar mensagem de compartilhamento de imóvel via WhatsApp.

const TIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Imóvel Comercial",
  terreno: "Terreno",
  cobertura: "Cobertura",
  studio: "Studio",
  sala: "Sala Comercial",
};

const FINALIDADE_LABEL: Record<string, string> = {
  locacao: "Locação",
  venda: "Venda",
  ambos: "Locação e Venda",
};

function formatBRL(v: number | null | undefined) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v));
}

export type ImovelShareInput = {
  tipo?: string | null;
  finalidade?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  quartos?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  area_m2?: number | null;
  valor_aluguel?: number | null;
  valor_venda?: number | null;
  vitrine_url?: string | null;
  codigo?: string | null;
};

export function buildImovelShareMessage(
  imovel: ImovelShareInput,
  fotos: string[] = [],
  opts: { includePhotoLinks?: boolean } = {},
): string {
  const lines: string[] = [];

  const tipo = TIPO_LABEL[imovel.tipo ?? ""] ?? (imovel.tipo ? imovel.tipo : "Imóvel");
  const fin = FINALIDADE_LABEL[imovel.finalidade ?? ""] ?? null;
  lines.push(`🏠 ${tipo}${fin ? ` · ${fin}` : ""}`);

  const endereco = [
    [imovel.rua, imovel.numero].filter(Boolean).join(", "),
    [imovel.bairro, imovel.cidade].filter(Boolean).join(" — "),
  ]
    .filter((s) => s && s.length > 0)
    .join(" — ");
  if (endereco) lines.push(`📍 ${endereco}`);

  const specs: string[] = [];
  if (imovel.quartos != null) specs.push(`🛏 ${imovel.quartos} quartos`);
  if (imovel.banheiros != null) specs.push(`🚿 ${imovel.banheiros} banheiros`);
  if (imovel.vagas != null) specs.push(`🚗 ${imovel.vagas} vagas`);
  if (imovel.area_m2 != null) specs.push(`📐 ${imovel.area_m2} m²`);
  if (specs.length) lines.push(specs.join(" · "));

  const fin2 = imovel.finalidade ?? "";
  const mostraAluguel = fin2 === "locacao" || fin2 === "ambos";
  const mostraVenda = fin2 === "venda" || fin2 === "ambos";
  const aluguel = mostraAluguel ? formatBRL(imovel.valor_aluguel) : null;
  const venda = mostraVenda ? formatBRL(imovel.valor_venda) : null;
  if (aluguel) lines.push(`💰 Aluguel: ${aluguel}/mês`);
  if (venda) lines.push(`💰 Venda: ${venda}`);

  if (imovel.vitrine_url) lines.push(`\n🔗 ${imovel.vitrine_url}`);

  if (opts.includePhotoLinks) {
    const fotosTop = fotos.filter(Boolean).slice(0, 3);
    if (fotosTop.length) {
      lines.push("");
      fotosTop.forEach((u) => lines.push(u));
    }
  }

  return lines.join("\n");
}

export function openWhatsAppShare(message: string, telefone?: string | null) {
  const phone = telefone ? telefone.replace(/\D/g, "") : "";
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function urlsToFiles(urls: string[], max = 6): Promise<File[]> {
  const top = urls.filter(Boolean).slice(0, max);
  const files: File[] = [];
  await Promise.all(
    top.map(async (url, i) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const type = blob.type || "image/jpeg";
        const ext = type.split("/")[1]?.split("+")[0] || "jpg";
        files.push(new File([blob], `imovel-${i + 1}.${ext}`, { type }));
      } catch {
        /* ignora foto que falhar */
      }
    }),
  );
  return files;
}

/**
 * Tenta abrir o menu de compartilhamento NATIVO com fotos reais (Web Share API Level 2).
 * Faz fallback para wa.me com texto puro (sem links de foto) se não suportado.
 */
export async function shareImovelNative(
  imovel: ImovelShareInput,
  fotosUrls: string[] = [],
): Promise<"native" | "whatsapp"> {
  const text = buildImovelShareMessage(imovel, fotosUrls, { includePhotoLinks: false });

  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;
    if (nav && typeof nav.share === "function") {
      const files = await urlsToFiles(fotosUrls);
      const data: ShareData & { files?: File[] } = { text };
      if (files.length && typeof nav.canShare === "function" && nav.canShare({ files })) {
        data.files = files;
      }
      if (!data.files && !nav.canShare?.({ text })) {
        // share existe mas não aceita esse payload — cai no fallback
        throw new Error("share não suportado para esse payload");
      }
      await nav.share(data);
      return "native";
    }
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "AbortError") return "native"; // usuário cancelou
    // segue para fallback
  }

  const fallbackMsg = buildImovelShareMessage(imovel, fotosUrls, { includePhotoLinks: true });
  openWhatsAppShare(fallbackMsg);
  return "whatsapp";
}
