import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Link2, Link2Off, MapPin, Video } from "lucide-react";
import { addBloqueio, addRecorrente, listDisponibilidade, removeDisponibilidade, type DisponibilidadeRow } from "@/lib/disponibilidade.functions";
import { disconnectGoogle, getGoogleStatus, startGoogleOAuth } from "@/lib/google.functions";
import { createReuniaoOnlineVenda, createVisita, deleteVisita, listImoveisForVisita, listMyVendasLeads, listReunioesCorretor, listVisitas, type ImovelOption, type ReuniaoCorretorRow, type VisitaRow } from "@/lib/visitas.functions";
import { buildVisitaConfirmacaoMsg, formatImovelEndereco, formatImovelOptionLabel } from "@/lib/visita-helpers";


export const Route = createFileRoute("/_authenticated/vendas/agenda")({
  head: () => ({ meta: [{ title: "Minha Agenda — Vendas" }] }),
  component: AgendaCorretorPage,
});

type VisitaItem = VisitaRow & { vendas_leads: { nome: string; telefone: string } | null };
type ReuniaoItem = ReuniaoCorretorRow;
type LeadOption = { id: string; nome: string; telefone: string; etapa: string };
type AgendaSlot = { recs: DisponibilidadeRow[]; blocked: boolean; visitas: VisitaItem[]; reunioes: ReuniaoItem[] };

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
  const fnListVisitas = useServerFn(listVisitas);
  const fnListReunioes = useServerFn(listReunioesCorretor);
  const fnCreateVisita = useServerFn(createVisita);
  const fnCreateReuniao = useServerFn(createReuniaoOnlineVenda);
  const fnDeleteVisita = useServerFn(deleteVisita);
  const fnListLeads = useServerFn(listMyVendasLeads);
  const fnListImoveis = useServerFn(listImoveisForVisita);


  const [items, setItems] = useState<DisponibilidadeRow[]>([]);
  const [visitas, setVisitas] = useState<VisitaItem[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoItem[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState(new Date());
  const [openRec, setOpenRec] = useState(false);
  const [openBlock, setOpenBlock] = useState(false);
  const [openVisita, setOpenVisita] = useState(false);
  const [openReuniao, setOpenReuniao] = useState(false);
  const [visitaDefaults, setVisitaDefaults] = useState<{ date: string; time: string }>({ date: "", time: "09:00" });
  const [reuniaoDefaults, setReuniaoDefaults] = useState<{ date: string; time: string }>({ date: "", time: "09:00" });
  const [savingVisita, setSavingVisita] = useState(false);
  const [savingReuniao, setSavingReuniao] = useState(false);
  const [google, setGoogle] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [disp, vis, reun, lds] = await Promise.all([
        fnList({ data: {} }),
        fnListVisitas(),
        fnListReunioes(),
        fnListLeads(),
      ]);
      setItems(disp.items);
      setVisitas(vis.items as VisitaItem[]);
      setReunioes(reun.items as ReuniaoItem[]);
      setLeads(lds.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar agenda");
    } finally { setLoading(false); }
  }, [fnList, fnListVisitas, fnListReunioes, fnListLeads]);

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
    const vis = visitas.filter((v) => format(new Date(v.data_inicio), "yyyy-MM-dd") === dateStr);
    const reun = reunioes.filter((r) => format(new Date(r.data_inicio), "yyyy-MM-dd") === dateStr);
    return { recs, blocked, visitas: vis, reunioes: reun };
  }

  function openVisitaFor(date: Date, time?: string) {
    setVisitaDefaults({ date: format(date, "yyyy-MM-dd"), time: time ?? "09:00" });
    setOpenVisita(true);
  }

  function openReuniaoFor(date: Date, time?: string) {
    setReuniaoDefaults({ date: format(date, "yyyy-MM-dd"), time: time ?? "09:00" });
    setOpenReuniao(true);
  }

  function whatsappLink(telefone: string, msg: string) {
    const tel = telefone.replace(/\D/g, "");
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  }

  async function handleAddVisita(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const leadId = String(fd.get("lead_id") || "");
    const endereco = String(fd.get("endereco") || "").trim();
    const data = String(fd.get("data") || "");
    const hora = String(fd.get("hora") || "");
    const observacoes = String(fd.get("observacoes") || "").trim();
    if (!leadId || !endereco || !data || !hora) { toast.error("Preencha todos os campos"); return; }
    setSavingVisita(true);
    try {
      const iso = new Date(`${data}T${hora}:00`).toISOString();
      const res = await fnCreateVisita({ data: {
        lead_id: leadId,
        endereco,
        data_inicio: iso,
        duracao_min: 60,
        observacoes: observacoes || undefined,
      }});
      toast.success("Visita agendada!");
      setOpenVisita(false);
      refresh();
      if (res.lead?.telefone) {
        const dataFmt = format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        const msg = `Olá ${res.lead.nome}! Confirmando nossa visita ao imóvel em ${endereco} no dia ${dataFmt}. Qualquer dúvida estou à disposição.`;
        window.open(whatsappLink(res.lead.telefone, msg), "_blank");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao agendar"); }
    finally { setSavingVisita(false); }
  }

  async function handleAddReuniao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const leadId = String(fd.get("lead_id") || "");
    const data = String(fd.get("data") || "");
    const hora = String(fd.get("hora") || "");
    const observacoes = String(fd.get("observacoes") || "").trim();
    if (!leadId || !data || !hora) { toast.error("Selecione o lead, data e hora"); return; }
    setSavingReuniao(true);
    try {
      const iso = new Date(`${data}T${hora}:00`).toISOString();
      const res = await fnCreateReuniao({ data: {
        lead_id: leadId,
        data_inicio: iso,
        duracao_min: 45,
        observacoes: observacoes || undefined,
      }});
      toast.success(res.meetLink ? "Reunião online agendada" : "Reunião registrada sem link Meet");
      setOpenReuniao(false);
      refresh();
      if (res.lead?.telefone) {
        const dataFmt = format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        const link = res.meetLink ? ` Link: ${res.meetLink}` : "";
        const msg = `Olá ${res.lead.nome}! Confirmando nossa reunião online no dia ${dataFmt}.${link}`;
        window.open(whatsappLink(res.lead.telefone, msg), "_blank");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao agendar reunião"); }
    finally { setSavingReuniao(false); }
  }

  async function handleDeleteVisita(id: string) {
    if (!confirm("Cancelar esta visita?")) return;
    try { await fnDeleteVisita({ data: { id } }); toast.success("Visita removida"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
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

      {/* Agendar visita — destaque */}
      <div className="rounded-xl border-2 border-orange-500/40 bg-orange-500/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <MapPin className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-sm">Visita presencial ao imóvel</div>
            <div className="text-xs text-muted-foreground">Agende uma visita, mova o lead automaticamente e envie WhatsApp de confirmação</div>
          </div>
        </div>
        <Button onClick={() => openVisitaFor(new Date())} variant="default" size="sm" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-1" /> Agendar Visita
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Video className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-sm">Reunião online com lead</div>
            <div className="text-xs text-muted-foreground">Crie uma reunião individual com Google Meet para um lead do seu pipeline</div>
          </div>
        </div>
        <Button onClick={() => openReuniaoFor(new Date())} variant="gold" size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Agendar Reunião
        </Button>
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
      {view === "mes"
        ? <MonthView cursor={cursor} slotsForDate={slotsForDate} onSlotClick={openVisitaFor} onReuniaoClick={openReuniaoFor} />
        : <ListView view={view} cursor={cursor} slotsForDate={slotsForDate} onSlotClick={openVisitaFor} onReuniaoClick={openReuniaoFor} onRemoveVisita={handleDeleteVisita} />}

      {/* Dialog: nova visita */}
      <Dialog open={openVisita} onOpenChange={setOpenVisita}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar visita ao imóvel</DialogTitle></DialogHeader>
          <form onSubmit={handleAddVisita} className="space-y-3">
            <div>
              <Label>Lead</Label>
              <Select name="lead_id" required>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o lead..." /></SelectTrigger>
                <SelectContent>
                  {leads.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum lead cadastrado</div>
                  ) : leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} · {l.telefone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endereço do imóvel</Label>
              <Input name="endereco" required maxLength={300} className="mt-1.5" placeholder="Rua, número, bairro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" name="data" required defaultValue={visitaDefaults.date} className="mt-1.5" /></div>
              <div><Label>Hora</Label><Input type="time" name="hora" required defaultValue={visitaDefaults.time} className="mt-1.5" /></div>
            </div>
            <div><Label>Observações (opcional)</Label><Textarea name="observacoes" maxLength={500} className="mt-1.5" placeholder="Ex.: levar contrato, cliente prefere entrada lateral" /></div>
            <DialogFooter>
              <Button type="submit" disabled={savingVisita} className="bg-orange-500 hover:bg-orange-600 text-white">
                {savingVisita && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Agendar e enviar WhatsApp
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openReuniao} onOpenChange={setOpenReuniao}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar reunião online</DialogTitle></DialogHeader>
          <form onSubmit={handleAddReuniao} className="space-y-3">
            <div>
              <Label>Lead</Label>
              <Select name="lead_id" required>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o lead..." /></SelectTrigger>
                <SelectContent>
                  {leads.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum lead cadastrado</div>
                  ) : leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} · {l.telefone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" name="data" required defaultValue={reuniaoDefaults.date} className="mt-1.5" /></div>
              <div><Label>Hora</Label><Input type="time" name="hora" required defaultValue={reuniaoDefaults.time} className="mt-1.5" /></div>
            </div>
            <div><Label>Pauta / observações</Label><Textarea name="observacoes" maxLength={500} className="mt-1.5" /></div>
            <DialogFooter>
              <Button type="submit" variant="gold" disabled={savingReuniao}>
                {savingReuniao && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Agendar reunião
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

function ListView({ view, cursor, slotsForDate, onSlotClick, onReuniaoClick, onRemoveVisita }: {
  view: View; cursor: Date;
  slotsForDate: (d: Date) => AgendaSlot;
  onSlotClick: (date: Date, time?: string) => void;
  onReuniaoClick: (date: Date, time?: string) => void;
  onRemoveVisita: (id: string) => void;
}) {
  const days = useMemo(() => {
    if (view === "dia") return [cursor];
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  return (
    <div className="grid gap-2">
      {days.map((d) => {
        const { recs, blocked, visitas, reunioes } = slotsForDate(d);
        const today = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className={`rounded-xl border ${today ? "border-gold" : "border-border"} bg-card p-3`}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-sm font-semibold">{format(d, "EEE, dd/MM", { locale: ptBR })}</div>
              <div className="flex items-center gap-1">
                {blocked && <Badge variant="destructive">Bloqueado</Badge>}
                {!blocked && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 text-orange-600 hover:text-orange-700 hover:bg-orange-500/10" onClick={() => onSlotClick(d)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Visita
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-gold hover:text-gold hover:bg-gold/10" onClick={() => onReuniaoClick(d)}>
                      <Video className="h-3.5 w-3.5 mr-1" /> Online
                    </Button>
                  </>
                )}
              </div>
            </div>
            {recs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem disponibilidade.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {recs.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => onSlotClick(d, r.hora_inicio?.slice(0,5))}
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs transition ${blocked ? "line-through opacity-60 cursor-not-allowed" : "hover:border-orange-500 hover:bg-orange-500/10"} bg-secondary text-secondary-foreground border-transparent`}
                  >
                    {r.hora_inicio?.slice(0,5)} – {r.hora_fim?.slice(0,5)}
                  </button>
                ))}
              </div>
            )}
            {visitas.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {visitas.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="font-medium text-orange-700 dark:text-orange-400 truncate">
                        {format(new Date(v.data_inicio), "HH:mm")} · {v.vendas_leads?.nome ?? "Lead"}
                      </div>
                      <div className="text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.endereco}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => onRemoveVisita(v.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {reunioes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {reunioes.map((r) => (
                  <div key={r.id} className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="font-medium text-gold truncate">
                        {format(new Date(r.data_inicio), "HH:mm")} · {r.titulo}
                      </div>
                      {r.local && <div className="text-muted-foreground truncate flex items-center gap-1"><Video className="h-3 w-3" /> {r.local}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, slotsForDate, onSlotClick, onReuniaoClick }: {
  cursor: Date;
  slotsForDate: (d: Date) => AgendaSlot;
  onSlotClick: (date: Date, time?: string) => void;
  onReuniaoClick: (date: Date, time?: string) => void;
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
          const { recs, blocked, visitas, reunioes } = slotsForDate(d);
          const inMonth = isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          return (
            <div
              key={d.toISOString()}
              className={`text-left min-h-[60px] sm:min-h-[80px] p-1.5 border-t border-l border-border first:border-l-0 ${!inMonth ? "opacity-40" : ""} ${!blocked ? "hover:bg-orange-500/5" : "cursor-not-allowed"}`}
            >
              <div className={`text-[11px] font-medium ${today ? "text-gold" : ""}`}>{format(d, "d")}</div>
              {blocked ? (
                <div className="mt-1 text-[9px] text-destructive">Bloqueado</div>
              ) : (
                <>
                  {recs.length > 0 && <div className="mt-1 text-[9px] text-gold font-medium">{recs.length} janela{recs.length > 1 ? "s" : ""}</div>}
                  {visitas.length > 0 && (
                    <div className="mt-1 inline-flex items-center rounded px-1 py-0.5 bg-orange-500 text-white text-[9px] font-medium">
                      {visitas.length} visita{visitas.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {reunioes.length > 0 && (
                    <div className="mt-1 inline-flex items-center rounded px-1 py-0.5 bg-gold text-gold-foreground text-[9px] font-medium">
                      {reunioes.length} online
                    </div>
                  )}
                  <div className="mt-1 flex gap-1">
                    <button type="button" onClick={() => onSlotClick(d)} className="text-[9px] text-orange-600 hover:underline">Visita</button>
                    <button type="button" onClick={() => onReuniaoClick(d)} className="text-[9px] text-gold hover:underline">Online</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
