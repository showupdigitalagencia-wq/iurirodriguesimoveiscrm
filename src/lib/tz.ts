// Timezone padrão do sistema: horário de Brasília.
// Todas as datas são gravadas em UTC no banco; a conversão para exibição
// e para textos de notificação acontece aqui.
export const BR_TZ = "America/Sao_Paulo";

type DateLike = string | number | Date;

function toDate(d: DateLike): Date {
  return d instanceof Date ? d : new Date(d);
}

export function fmtDateBR(d: DateLike): string {
  return toDate(d).toLocaleDateString("pt-BR", {
    timeZone: BR_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtTimeBR(d: DateLike): string {
  return toDate(d).toLocaleTimeString("pt-BR", {
    timeZone: BR_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateTimeBR(d: DateLike): string {
  return toDate(d).toLocaleString("pt-BR", {
    timeZone: BR_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
