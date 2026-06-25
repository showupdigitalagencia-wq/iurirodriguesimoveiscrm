/**
 * Normaliza um telefone para o formato internacional brasileiro:
 * - Remove todos os caracteres não numéricos
 * - Garante o prefixo "55" (país) antes do DDD
 * - Retorna `null` se a entrada for vazia ou não fizer sentido
 *
 * Aceita entradas como:
 *   "(21) 99999-9999" -> "5521999999999"
 *   "21999999999"     -> "5521999999999"
 *   "+55 21 99999-9999" -> "5521999999999"
 *   "5521999999999"   -> "5521999999999"
 */
export function normalizePhoneBR(input: string | null | undefined): string | null {
  if (input == null) return null;
  let d = String(input).replace(/\D/g, "");
  if (!d) return null;
  // remove zeros à esquerda (ex.: 021...)
  d = d.replace(/^0+/, "");
  if (!d) return null;
  // já tem 55 + DDD + número (12 ou 13 dígitos): mantém
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    return d;
  }
  // DDD + número (10 ou 11 dígitos): adiciona 55
  if (d.length === 10 || d.length === 11) {
    return `55${d}`;
  }
  // Caso degenerado (sem DDD ou número incompleto): retorna como veio
  return d;
}

/** Gera link wa.me já normalizado. Retorna null se telefone for inválido. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const n = normalizePhoneBR(phone);
  if (!n) return null;
  const base = `https://wa.me/${n}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
