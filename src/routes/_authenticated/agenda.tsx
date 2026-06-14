import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listReunioes, type ReuniaoRow } from "@/lib/reunioes.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReuniaoFormDialog } from "@/components/reuniao-form-dialog";
import { ReuniaoDetailDialog } from "@/components/reuniao-detail-dialog";
import { addDays, addMonths, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Sistema NEXUS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ open: typeof s.open === "string" ? s.open : undefined }),
  component: AgendaPage,
});

type View = "dia" | "semana" | "mes";

function AgendaPage() {
  const search = Route.useSearch();
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [reunioes, setReunioes] = useState<ReuniaoRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const callList = useServerFn(listReunioes);

  const { from, to } = useMemo(() => {
    if (view === "dia") return { from: startOfDay(cursor), to: endOfDay(cursor) };
    if (view === "semana") return { from: startOfWeek(cursor, { weekStartsOn: 0 }), to: endOfWeek(cursor, { weekStartsOn: 0 }) };
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    return { from: startOfWeek(monthStart, { weekStartsOn: 0 }), to: endOfWeek(monthEnd, { weekStartsOn: 0 }) };
  }, [view, cursor]);

  async function load() {
    try {
      const res = await callList({ data: { from: from.toISOString(), to: to.toISOString() } });
      setReunioes(res.reunioes);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from.toISOString(), to.toISOString()]);

  function shift(dir: -1 | 1) {
    if (view === "dia") setCursor((c) => addDays(c, dir));
    else if (view === "semana") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
  }

  const headerLabel = useMemo(() => {
    if (view === "dia") return format(cursor, "PPP", { locale: ptBR });
    if (view === "semana") return `${format(from, "dd/MM")} – ${format(to, "dd/MM")}`;
    return format(cursor, "MMMM yyyy", { locale: ptBR });
  }, [view, cursor, from, to]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">Agenda</h1>
          <p className="text-xs text-muted-foreground">Reuniões e compromissos</p>
        </div>
        <Button variant="gold" onClick={() => setFormOpen(true)} className="h-11">
          <Plus className="h-4 w-4" /> Nova reunião
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-medium capitalize min-w-[140px] text-center">{headerLabel}</div>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
        </div>
      </div>

      {view === "mes" && <MonthGrid cursor={cursor} from={from} reunioes={reunioes} onOpen={setOpenId} />}
      {view === "semana" && <WeekList from={from} reunioes={reunioes} onOpen={setOpenId} />}
      {view === "dia" && <DayList day={cursor} reunioes={reunioes} onOpen={setOpenId} />}

      <ReuniaoFormDialog open={formOpen} onOpenChange={setFormOpen} onCreated={() => load()} />
      <ReuniaoDetailDialog reuniaoId={openId} onClose={() => setOpenId(null)} onChanged={() => load()} />
    </div>
  );
}

function colorFor(tipo: ReuniaoRow["tipo"]) {
  if (tipo === "alinhamento") return "bg-red-600 text-white border-red-700";
  if (tipo === "institucional") return "bg-gold/90 text-gold-foreground border-gold";
  return "bg-blue-500 text-white border-blue-600";
}

function MonthGrid({ cursor, from, reunioes, onOpen }: { cursor: Date; from: Date; reunioes: ReuniaoRow[]; onOpen: (id: string) => void }) {
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(from, i));
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 text-[10px] sm:text-xs font-semibold bg-muted/40">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="p-2 text-center text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const dayR = reunioes.filter((r) => isSameDay(new Date(r.data_inicio), d));
          return (
            <div key={d.toISOString()} className={`min-h-20 sm:min-h-28 border-t border-r border-border p-1 sm:p-1.5 ${inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}>
              <div className="text-[10px] sm:text-xs font-medium mb-1">{format(d, "d")}</div>
              <div className="space-y-1">
                {dayR.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className={`block w-full text-left text-[10px] sm:text-xs px-1.5 py-1 rounded border ${colorFor(r.tipo)} truncate`}
                  >
                    {format(new Date(r.data_inicio), "HH:mm")} {r.titulo}
                  </button>
                ))}
                {dayR.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayR.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekList({ from, reunioes, onOpen }: { from: Date; reunioes: ReuniaoRow[]; onOpen: (id: string) => void }) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(from, i));
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <DayList key={d.toISOString()} day={d} reunioes={reunioes} onOpen={onOpen} compact />
      ))}
    </div>
  );
}

function DayList({ day, reunioes, onOpen, compact }: { day: Date; reunioes: ReuniaoRow[]; onOpen: (id: string) => void; compact?: boolean }) {
  const items = reunioes.filter((r) => isSameDay(new Date(r.data_inicio), day))
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className={`px-3 py-2 font-semibold text-sm border-b border-border bg-muted/30 capitalize ${compact ? "text-xs" : ""}`}>
        {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </div>
      <div className="p-2 space-y-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">Sem reuniões</p>}
        {items.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className={`block w-full text-left p-3 rounded-md border ${colorFor(r.tipo)} hover:opacity-90 transition`}
          >
            <div className="flex justify-between gap-2 text-xs opacity-90">
              <span>{format(new Date(r.data_inicio), "HH:mm")} · {r.duracao_min}min</span>
              <span className="uppercase">{r.tipo}</span>
            </div>
            <div className="font-semibold truncate">{r.titulo}</div>
            {r.local && <div className="text-xs opacity-90 truncate">{r.local}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
