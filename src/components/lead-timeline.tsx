import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeadTimeline, type TimelineCategoria, type TimelineEvent } from "@/lib/lead-timeline.functions";
import {
  UserPlus, Repeat, ArrowRightLeft, Workflow, CalendarPlus, CalendarX, Trophy, Shield, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "transferencia" | "etapa" | "agendamento" | "admin";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "transferencia", label: "Transferências" },
  { id: "etapa", label: "Mudanças de etapa" },
  { id: "agendamento", label: "Agendamentos" },
  { id: "admin", label: "Eventos administrativos" },
];

const META: Record<TimelineCategoria, { Icon: typeof UserPlus; cls: string }> = {
  criacao:       { Icon: Sparkles,        cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  atribuicao:    { Icon: UserPlus,        cls: "text-sky-500 bg-sky-500/10 border-sky-500/30" },
  transferencia: { Icon: ArrowRightLeft,  cls: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  etapa:         { Icon: Workflow,        cls: "text-violet-500 bg-violet-500/10 border-violet-500/30" },
  agendamento:   { Icon: CalendarPlus,    cls: "text-sky-500 bg-sky-500/10 border-sky-500/30" },
  cancelamento:  { Icon: CalendarX,       cls: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  fechamento:    { Icon: Trophy,          cls: "text-gold bg-gold/10 border-gold/30" },
  admin:         { Icon: Shield,          cls: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
};

function matches(filtro: Filtro, ev: TimelineEvent): boolean {
  if (filtro === "todos") return true;
  if (filtro === "agendamento") return ev.categoria === "agendamento" || ev.categoria === "cancelamento";
  return ev.categoria === filtro;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function LeadTimeline({ leadId, open }: { leadId: string; open: boolean }) {
  const fn = useServerFn(getLeadTimeline);
  const { data, isLoading, error } = useQuery({
    queryKey: ["lead_timeline", leadId],
    enabled: !!leadId && open,
    queryFn: () => fn({ data: { lead_id: leadId } }),
  });
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const events = useMemo(() => {
    const list = (data?.events ?? []).slice().reverse(); // mais recentes primeiro
    return list.filter((e) => matches(filtro, e));
  }, [data, filtro]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
              filtro === f.id
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/40",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card/40">
        {isLoading && <div className="p-4 text-xs text-muted-foreground">Carregando timeline...</div>}
        {error && <div className="p-4 text-xs text-rose-500">Não foi possível carregar a timeline.</div>}
        {!isLoading && !error && events.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">Nenhum evento neste filtro.</div>
        )}

        <ol className="relative">
          {events.map((ev, idx) => {
            const meta = META[ev.categoria];
            const Icon = meta.Icon;
            const isOpen = !!expandido[ev.id];
            return (
              <li key={ev.id} className="relative pl-12 pr-4 py-3 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                {/* linha do tempo */}
                {idx !== events.length - 1 && (
                  <span aria-hidden className="absolute left-[22px] top-10 bottom-0 w-px bg-border" />
                )}
                <span
                  className={cn(
                    "absolute left-2 top-3 h-7 w-7 rounded-full border flex items-center justify-center",
                    meta.cls,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{ev.titulo}</div>
                    {ev.descricao && (
                      <div className="text-xs text-muted-foreground mt-0.5 break-words">{ev.descricao}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground/80 mt-1 flex flex-wrap gap-x-2">
                      <span>{fmt(ev.at)}</span>
                      {ev.responsavel.nome && <span>· por {ev.responsavel.nome}</span>}
                      {ev.alvo?.nome && <span>· para {ev.alvo.nome}</span>}
                    </div>
                  </div>

                  {ev.payload && (
                    <button
                      type="button"
                      onClick={() => setExpandido((s) => ({ ...s, [ev.id]: !s[ev.id] }))}
                      className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {isOpen ? "ocultar" : "detalhes"}
                    </button>
                  )}
                </div>

                {isOpen && ev.payload && (
                  <pre className="mt-2 text-[10px] leading-snug bg-muted/40 border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => { try { return JSON.stringify(JSON.parse(ev.payload), null, 2); } catch { return ev.payload; } })()}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Avoid unused-import lints on icons referenced only via META
void Repeat;
