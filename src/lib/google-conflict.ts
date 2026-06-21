import { verificarConflitoGoogleCalendar } from "@/lib/google.functions";

function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Verifica conflito com a agenda Google do usuário. Se houver, exibe um confirm()
 * com os horários ocupados. Retorna true para prosseguir, false para cancelar.
 *
 * Se o Google não estiver conectado ou a chamada falhar/expirar, prossegue
 * silenciosamente (não bloqueia o fluxo).
 */
export async function confirmNoGoogleConflict(
  startISO: string,
  durationMin: number,
): Promise<boolean> {
  const start = new Date(startISO);
  if (isNaN(start.getTime()) || !durationMin || durationMin <= 0) return true;
  const end = new Date(start.getTime() + durationMin * 60_000);

  try {
    const res = await verificarConflitoGoogleCalendar({
      data: { start: start.toISOString(), end: end.toISOString() },
    });
    if (!res.verificado) return true;
    if (!res.conflito) return true;

    const ocupadosFmt = res.ocupados
      .slice(0, 3)
      .map((b) => `• ${fmtHora(b.start)}–${fmtHora(b.end)}`)
      .join("\n");
    const extras = res.ocupados.length > 3 ? `\n…e mais ${res.ocupados.length - 3}.` : "";
    const msg =
      `Você já tem compromisso(s) na sua agenda Google nesse horário:\n\n${ocupadosFmt}${extras}\n\n` +
      `Deseja agendar mesmo assim?`;
    return window.confirm(msg);
  } catch {
    return true;
  }
}
