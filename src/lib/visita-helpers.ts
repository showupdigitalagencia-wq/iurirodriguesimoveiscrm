import type { ImovelOption } from "@/lib/visitas.functions";

export function formatImovelEndereco(im: Pick<ImovelOption, "rua" | "numero" | "complemento" | "bairro" | "cidade">): string {
  const parts: string[] = [];
  const ruaNumero = [im.rua, im.numero].filter(Boolean).join(", ");
  if (ruaNumero) parts.push(ruaNumero);
  if (im.complemento) parts.push(im.complemento);
  if (im.bairro) parts.push(im.bairro);
  if (im.cidade) parts.push(im.cidade);
  return parts.join(" - ");
}

export function formatImovelOptionLabel(im: ImovelOption): string {
  const cod = im.codigo ? `${im.codigo} · ` : "";
  return `${cod}${formatImovelEndereco(im)}`;
}

export function googleMapsLink(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

export function buildVisitaConfirmacaoMsg(opts: {
  nome: string;
  endereco: string;
  dataFmt: string;
  horaFmt: string;
}): string {
  const mapa = googleMapsLink(opts.endereco);
  return `Olá ${opts.nome}! Sua visita foi confirmada! 📍\n\nEndereço: ${opts.endereco}\nVer no mapa: ${mapa}\n\nData: ${opts.dataFmt} às ${opts.horaFmt}\n\nIuri Rodrigues Imóveis 🏢`;
}
