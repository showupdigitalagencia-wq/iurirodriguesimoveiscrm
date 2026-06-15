import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Link2, Link2Off } from "lucide-react";
import { addBloqueio, addRecorrente, listDisponibilidade, removeDisponibilidade, type DisponibilidadeRow } from "@/lib/disponibilidade.functions";
import { disconnectGoogle, getGoogleStatus, startGoogleOAuth } from "@/lib/google.functions";

export const Route = createFileRoute("/_authenticated/vendas/agenda")({
  head: () => ({ meta: [{ title: "Minha Agenda — Vendas" }] }),
  component: AgendaCorretorPage,
});

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
type View = "dia" | "semana" | "mes";

function AgendaCorretorPage() {
  const fnList = useServerFn(listDisponibilidade);
  const fnAddRec = useServerFn(addRecorrente);
  const fnAddBlock = useServerFn(addBloqueio);
  const fnRemove = useServerFn(removeDisponibilidade);
  const fnGoogleStatus = useServerFn(getGoogleStatus);
  const fnGoogleStart = useServerFn(startGoogleOAuth);
  const fnGoogleDisconnect = useServerFn(disconnectGoogle);

  const [items, setItems] = useState<DisponibilidadeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState(new Date());
  const [openRec, setOpenRec] = useState(false);
  const [openBlock, setOpenBlock] = useState(false);
  const [google, setGoogle] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { items } = await fnList({ data: {} });
      setItems(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar agenda");
    } finally { setLoading(false); }
  }, [fnList]);

  useEffect(() => {
    refresh();
    fnGoogleStatus().then(setGoogle).catch(() => null);
  }, [refresh, fnGoogleStatus]);

  const recorrentes = useMemo(() => items.filter((i) => i.tipo === "recorrente"), [items]);
  const bloqueios = useMemo(() => items.filter((i) => i.tipo === "bloqueio"), [items]);

  function shift(dir: -1 | 1) {
    if (view === "dia") setCursor((c) => addDays(c, dir));
    else if (view === "semana") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
  }

  const periodLabel = useMemo(() => {
    if (view === "dia") return format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (view === "semana") {
      const a = startOfWeek(cursor, { weekStartsOn: 0 });
      const b = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(a, "dd/MM")} – ${format(b, "dd/MM")}`;
    }
    return format(cursor, "MMMM yyyy", { locale: ptBR });
  }, [view, cursor]);

  function slotsForDate(date: Date) {
    const dow = date.getDay();
    const dateStr = format(date, "yyyy-MM-dd");
    const recs = recorrentes.filter((r) => r.dia_semana === dow);
    const blocked = bloqueios.some((b) => b.data === dateStr && !b.hora_inicio);
    return { recs, blocked };
  }

  async function handleAddRec(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fnAddRec({ data: {
        dia_semana: Number(fd.get("dia_semana")),
        hora_inicio: String(fd.get("hora_inicio")),
        hora_fim: String(fd.get("hora_fim")),
        observacao: String(fd.get("observacao") || "") || undefined,
      }});
      toast.success("Janela adicionada");
      setOpenRec(false); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function handleAddBlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fnAddBlock({ data: {
        data: String(fd.get("data")),
        observacao: String(fd.get("observacao") || "") || undefined,
      }});
      toast.success("Bloqueio registrado");
      setOpenBlock(false); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover este item?")) return;
    try { await fnRemove({ data: { id } }); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function connectGoogle() {
    setConnectingGoogle(true);
    try {
      const { url } = await fnGoogleStart();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conectar Google");
      setConnectingGoogle(false);
    }
  }

  async function dropGoogle() {
    if (!confirm("Desconectar Google Calendar?")) return;
    try { await fnGoogleDisconnect(); setGoogle({ connected: false, email: null }); toast.success("Desconectado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (loading) return <div className="p-6 text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Google Calendar */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <CalendarCheck2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-sm">Google Calendar</div>
            <div className="text-xs text-muted-foreground truncate">
              {google.connected ? `Conectado: ${google.email ?? ""}` : "Sincronize visitas e reuniões com sua agenda"}
            </div>
          </div>
        </div>
        {google.connected ? (
          <Button onClick={dropGoogle} variant="outline" size="sm" className="w-full sm:w-auto">
            <Link2Off className="h-4 w-4 mr-1" /> Desconectar
          </Button>
        ) : (
          <Button onClick={connectGoogle} variant="gold" size="sm" disabled={connectingGoogle} className="w-full sm:w-auto">
            {connectingGoogle ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
            Conectar Google
          </Button>
        )}
      </div>

      {/* Controle de visão */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button onClick={() => shift(-1)} variant="outline" size="icon" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-medium min-w-[10rem] text-center">{periodLabel}</div>
          <Button onClick={() => shift(1)} variant="outline" size="icon" aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={() => setCursor(new Date())} variant="ghost" size="sm">Hoje</Button>
        </div>
      </div>

      {/* Visão */}
      {view === "mes" ? <MonthView cursor={cursor} slotsForDate={slotsForDate} /> : <ListView view={view} cursor={cursor} slotsForDate={slotsForDate} />}

      {/* Gerenciar janelas */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-semibold">Disponibilidade recorrente</h2>
            <p className="text-xs text-muted-foreground">Janelas semanais em que você atende visitas</p>
          </div>
          <Dialog open={openRec} onOpenChange={setOpenRec}>
            <DialogTrigger asChild><Button size="sm" variant="gold"><Plus className="h-4 w-4 mr-1" /> Adicionar janela</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova janela semanal</DialogTitle></DialogHeader>
              <form onSubmit={handleAddRec} className="space-y-3">
                <div>
                  <Label>Dia da semana</Label>
                  <Select name="dia_semana" defaultValue="1">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início</Label><Input type="time" name="hora_inicio" required defaultValue="09:00" className="mt-1.5" /></div>
                  <div><Label>Fim</Label><Input type="time" name="hora_fim" required defaultValue="18:00" className="mt-1.5" /></div>
                </div>
                <div><Label>Observação (opcional)</Label><Input name="observacao" maxLength={200} className="mt-1.5" placeholder="Ex.: Apenas Barra da Tijuca" /></div>
                <DialogFooter><Button type="submit" variant="gold">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {recorrentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma janela cadastrada.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {recorrentes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{DIAS[r.dia_semana ?? 0]} · {r.hora_inicio?.slice(0,5)} – {r.hora_fim?.slice(0,5)}</div>
                  {r.observacao && <div className="text-xs text-muted-foreground truncate">{r.observacao}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(r.id)} className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bloqueios pontuais */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-semibold">Bloqueios pontuais</h2>
            <p className="text-xs text-muted-foreground">Dias específicos em que você não atende</p>
          </div>
          <Dialog open={openBlock} onOpenChange={setOpenBlock}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Bloquear data</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bloquear data</DialogTitle></DialogHeader>
              <form onSubmit={handleAddBlock} className="space-y-3">
                <div><Label>Data</Label><Input type="date" name="data" required className="mt-1.5" /></div>
                <div><Label>Motivo (opcional)</Label><Input name="observacao" maxLength={200} className="mt-1.5" placeholder="Ex.: Folga" /></div>
                <DialogFooter><Button type="submit" variant="gold">Bloquear</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>
        {bloqueios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {bloqueios.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{b.data && format(new Date(b.data + "T12:00:00"), "dd/MM/yyyy")}</div>
                  {b.observacao && <div className="text-xs text-muted-foreground truncate">{b.observacao}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(b.id)} className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ListView({ view, cursor, slotsForDate }: {
  view: View; cursor: Date;
  slotsForDate: (d: Date) => { recs: DisponibilidadeRow[]; blocked: boolean };
}) {
  const days = useMemo(() => {
    if (view === "dia") return [cursor];
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  return (
    <div className="grid gap-2">
      {days.map((d) => {
        const { recs, blocked } = slotsForDate(d);
        const today = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className={`rounded-xl border ${today ? "border-gold" : "border-border"} bg-card p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">{format(d, "EEE, dd/MM", { locale: ptBR })}</div>
              {blocked && <Badge variant="destructive">Bloqueado</Badge>}
            </div>
            {recs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem disponibilidade.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {recs.map((r) => (
                  <Badge key={r.id} variant={blocked ? "outline" : "secondary"} className={blocked ? "line-through opacity-60" : ""}>
                    {r.hora_inicio?.slice(0,5)} – {r.hora_fim?.slice(0,5)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, slotsForDate }: {
  cursor: Date; slotsForDate: (d: Date) => { recs: DisponibilidadeRow[]; blocked: boolean };
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
        {DIAS.map((d) => <div key={d} className="px-2 py-1.5 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const { recs, blocked } = slotsForDate(d);
          const inMonth = isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={`min-h-[60px] sm:min-h-[80px] p-1.5 border-t border-l border-border first:border-l-0 ${!inMonth ? "opacity-40" : ""}`}>
              <div className={`text-[11px] font-medium ${today ? "text-gold" : ""}`}>{format(d, "d")}</div>
              {blocked ? (
                <div className="mt-1 text-[9px] text-destructive">Bloqueado</div>
              ) : recs.length > 0 ? (
                <div className="mt-1 text-[9px] text-gold font-medium">{recs.length} janela{recs.length > 1 ? "s" : ""}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
