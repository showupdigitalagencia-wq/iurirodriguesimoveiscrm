import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ETAPAS, REGIOES, etapaNome, canalNome, regiaoNome, etapaColor, type LeadRow, type LeadRegiao } from "@/lib/lead-helpers";
import { updateLead, updateLeadEtapa, addNote, markFirstResponse, descredenciarCorretor } from "@/lib/leads.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, MapPin, Mail, Clock, MessageSquarePlus, CheckCircle2, ArrowLeft, Trash2, CalendarPlus, ShieldOff } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ReuniaoFormDialog } from "@/components/reuniao-form-dialog";
import { Termometro } from "@/components/termometro";
import { CorretorAvaliacaoPanel } from "@/components/corretor-avaliacao-panel";

type HistoricoRow = {
  id: string;
  acao: string;
  detalhe: unknown;
  created_at: string;
};

interface Props {
  leadId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  backLabel?: string;
}

export function LeadDetailSheet({ leadId, onClose, onUpdated, backLabel = "Voltar" }: Props) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string; canal: string | null }[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [nota, setNota] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", observacoes: "",
    canal: "denise" as LeadRow["canal"],
    responsavel_id: "" as string,
    regiao: "barra_da_tijuca" as LeadRegiao,
    etapa: "novos_leads" as LeadRow["etapa"],
    ja_corretor: "",
    creci_ativo: "",
    numero_creci: "",
    disponibilidade_regiao: "",
    disponibilidade_video: "",
    possui_veiculo: "",
  });
  const [agendarOpen, setAgendarOpen] = useState(false);

  const callUpdate = useServerFn(updateLead);
  const callEtapa = useServerFn(updateLeadEtapa);
  const callNote = useServerFn(addNote);
  const callFirst = useServerFn(markFirstResponse);
  const callDescredenciar = useServerFn(descredenciarCorretor);
  const [descredOpen, setDescredOpen] = useState(false);
  const [descredMotivo, setDescredMotivo] = useState("");
  const [descredLoading, setDescredLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle()
        .then(({ data: r }) => setIsAdmin(r?.role === "admin"));
    });
    supabase.from("responsaveis").select("id, nome, canal").eq("ativo", true).order("nome")
      .then(({ data }) => setResponsaveis((data as { id: string; nome: string; canal: string | null }[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!leadId) { setLead(null); return; }
    let active = true;
    async function load() {
      const [{ data: l }, { data: h }] = await Promise.all([
        supabase.from("leads").select("*").eq("id", leadId!).maybeSingle(),
        supabase.from("lead_historico").select("id, acao, detalhe, created_at").eq("lead_id", leadId!).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setLead((l as LeadRow) ?? null);
      setHistorico((h as HistoricoRow[]) ?? []);
      if (l) {
        const ll = l as LeadRow;
        const dc = (ll.dados_corretor ?? {}) as Record<string, string | null>;
        setForm({
          nome: ll.nome, email: ll.email ?? "", telefone: ll.telefone,
          observacoes: ll.observacoes ?? "", canal: ll.canal,
          responsavel_id: ll.responsavel_id ?? "",
          regiao: ll.regiao, etapa: ll.etapa,
          ja_corretor: dc.ja_corretor ?? "",
          creci_ativo: dc.creci_ativo ?? "",
          numero_creci: dc.numero_creci ?? ll.creci ?? "",
          disponibilidade_regiao: dc.disponibilidade_regiao ?? "",
          disponibilidade_video: dc.disponibilidade_video ?? "",
          possui_veiculo: dc.possui_veiculo ?? "",
        });
      }
    }
    load();
    return () => { active = false; };
  }, [leadId]);

  async function handleDelete() {
    if (!leadId) return;
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    onUpdated?.();
    onClose();
  }

  async function reload() {
    if (!leadId) return;
    const [{ data: l }, { data: h }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
      supabase.from("lead_historico").select("id, acao, detalhe, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }),
    ]);
    setLead((l as LeadRow) ?? null);
    setHistorico((h as HistoricoRow[]) ?? []);
    onUpdated?.();
  }

  async function save() {
    if (!leadId || !lead) return;
    try {
      const existingDc = (lead.dados_corretor ?? {}) as Record<string, string | null>;
      const dados_corretor = {
        ...existingDc,
        ja_corretor: form.ja_corretor || null,
        creci_ativo: form.creci_ativo || null,
        numero_creci: form.numero_creci || null,
        disponibilidade_regiao: form.disponibilidade_regiao || null,
        disponibilidade_video: form.disponibilidade_video || null,
        possui_veiculo: form.possui_veiculo || null,
      };
      const matchResp = responsaveis.find((r) => r.id === form.responsavel_id);
      const resolvedCanal = (matchResp?.canal as LeadRow["canal"] | undefined) ?? form.canal;
      await callUpdate({ data: { id: leadId, patch: {
        nome: form.nome, email: form.email || null, telefone: form.telefone,
        observacoes: form.observacoes || null, canal: resolvedCanal,
        responsavel_id: form.responsavel_id || null,
        regiao: form.regiao, etapa: form.etapa,
        dados_corretor,
      } } });
      toast.success("Lead atualizado");
      setEditing(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  async function changeEtapa(etapa: LeadRow["etapa"]) {
    if (!leadId) return;
    try {
      await callEtapa({ data: { id: leadId, etapa } });
      toast.success(`Movido para ${etapaNome(etapa)}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function postNote() {
    if (!leadId || !nota.trim()) return;
    try {
      await callNote({ data: { lead_id: leadId, nota: nota.trim() } });
      setNota("");
      toast.success("Nota adicionada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function markResponse() {
    if (!leadId) return;
    try {
      await callFirst({ data: { id: leadId } });
      toast.success("Primeira resposta registrada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function confirmDescredenciar() {
    if (!leadId) return;
    const motivo = descredMotivo.trim();
    if (motivo.length < 3) { toast.error("Informe o motivo (mín. 3 caracteres)"); return; }
    setDescredLoading(true);
    try {
      const res = await callDescredenciar({ data: { lead_id: leadId, motivo } });
      const extra = res.leads_vendas_pendentes
        ? ` ${res.leads_vendas_pendentes} lead(s) de vendas marcados para reatribuição.`
        : "";
      toast.success(`Corretor descredenciado.${extra}`);
      setDescredOpen(false);
      setDescredMotivo("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao descredenciar");
    } finally {
      setDescredLoading(false);
    }
  }

  const whatsappLink = lead ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : "#";

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full sm:max-w-xl overflow-y-auto p-0 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = Math.abs(t.clientY - start.y);
          if (dx > 80 && dy < 60) onClose();
          touchStartRef.current = null;
        }}
      >
        {lead ? (
          <>
            {/* Back button — mobile: barra dedicada com área de toque ≥44px */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden sticky top-0 z-10 w-full flex items-center gap-2 px-4 h-12 bg-background border-b border-border text-sm font-medium text-foreground"
              style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(3rem + env(safe-area-inset-top))" }}
              aria-label={backLabel}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="truncate">{backLabel}</span>
            </button>

            <div className="p-4 md:p-6">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-xl md:text-2xl truncate">{lead.nome}</SheetTitle>
                    <SheetDescription className="flex items-center flex-wrap gap-2 mt-1">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md border ${etapaColor(lead.etapa).badge}`}>{etapaNome(lead.etapa)}</span>
                      {lead.is_corretor && <Badge variant="secondary">Corretor</Badge>}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

            {/* Ações: inline no desktop, rodapé fixo no mobile */}
            <div className="hidden md:flex mt-4 flex-wrap gap-2">
              <Button asChild variant="gold" size="sm">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${lead.telefone}`}><Phone className="h-4 w-4" /> Ligar</a>
              </Button>
              <Button onClick={() => setAgendarOpen(true)} variant="outline" size="sm">
                <CalendarPlus className="h-4 w-4" /> Agendar reunião
              </Button>
              {!lead.first_response_at && (
                <Button onClick={markResponse} variant="outline" size="sm">
                  <CheckCircle2 className="h-4 w-4" /> Marcar resposta
                </Button>
              )}
            </div>

            <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)] flex gap-2">
              <Button asChild variant="gold" className="flex-1 h-12">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-5 w-5" /> WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1 h-12">
                <a href={`tel:${lead.telefone}`}><Phone className="h-5 w-5" /> Ligar</a>
              </Button>
              <Button onClick={() => setAgendarOpen(true)} variant="outline" className="h-12 px-3" aria-label="Agendar reunião">
                <CalendarPlus className="h-5 w-5" />
              </Button>
              {!lead.first_response_at && (
                <Button onClick={markResponse} variant="outline" className="h-12 px-3" aria-label="Marcar resposta">
                  <CheckCircle2 className="h-5 w-5" />
                </Button>
              )}
            </div>


            <Separator className="my-5" />

            <Tabs defaultValue="info">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                {lead.etapa === "fechado" && (
                  <CorretorAvaliacaoPanel
                    leadId={lead.id}
                    corretorProfileId={null}
                    responsavelId={lead.responsavel_id}
                  />
                )}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex flex-wrap gap-2">
                    {isAdmin && !editing && lead.etapa === "fechado" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/30"
                        onClick={() => { setDescredMotivo(""); setDescredOpen(true); }}
                      >
                        <ShieldOff className="h-4 w-4" /> Descredenciar
                      </Button>
                    )}
                    {isAdmin && !editing && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" /> Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita. O lead e todo o histórico serão removidos do banco de dados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  {editing ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button variant="gold" size="sm" onClick={save}>Salvar</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
                    <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
                    <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                    <Field label="Região">
                      <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v as LeadRegiao })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Responsável / Executivo">
                      <Select
                        value={form.responsavel_id || ""}
                        onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione um executivo" /></SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Etapa do pipeline">
                      <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v as LeadRow["etapa"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ETAPAS.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Separator />
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Perguntas do formulário</div>

                    <Field label="Já atua como corretor?">
                      <Select value={form.ja_corretor} onValueChange={(v) => setForm({ ...form, ja_corretor: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim, credenciado">Sim, credenciado</SelectItem>
                          <SelectItem value="Ainda não">Ainda não</SelectItem>
                          <SelectItem value="Em processo">Em processo</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="CRECI ativo?">
                      <Select value={form.creci_ativo} onValueChange={(v) => setForm({ ...form, creci_ativo: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Em andamento">Em andamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Número do CRECI">
                      <Input value={form.numero_creci} onChange={(e) => setForm({ ...form, numero_creci: e.target.value })} />
                    </Field>
                    <Field label="Disponibilidade para atuar na região?">
                      <Select value={form.disponibilidade_regiao} onValueChange={(v) => setForm({ ...form, disponibilidade_regiao: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Disponibilidade para videochamada diária?">
                      <Select value={form.disponibilidade_video} onValueChange={(v) => setForm({ ...form, disponibilidade_video: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Possui veículo?">
                      <Select value={form.possui_veiculo} onValueChange={(v) => setForm({ ...form, possui_veiculo: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Separator />
                    <Field label="Observações"><Textarea rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    {lead.etapa === "descredenciado" && (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
                        <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-xs uppercase tracking-wide font-semibold">
                          <ShieldOff className="h-3.5 w-3.5" /> Descredenciado
                        </div>
                        {lead.motivo_descredenciamento && (
                          <p className="mt-1.5 text-sm whitespace-pre-wrap text-red-900 dark:text-red-200">{lead.motivo_descredenciamento}</p>
                        )}
                        {lead.descredenciado_em && (
                          <div className="mt-1 text-[11px] text-red-700/80 dark:text-red-300/70">
                            {format(new Date(lead.descredenciado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    )}
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={lead.telefone} />
                    {lead.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} />}
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Região" value={regiaoNome(lead.regiao)} />
                    <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="Responsável" value={canalNome(lead.canal)} />
                    {lead.tipo_imovel && <InfoRow label="Tipo de imóvel" value={lead.tipo_imovel} />}
                    {lead.faixa_valor && <InfoRow label="Faixa de valor" value={lead.faixa_valor} />}
                    {lead.creci && <InfoRow label="CRECI" value={lead.creci} />}
                    {lead.observacoes && (
                      <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Observações</div>
                        <p className="whitespace-pre-wrap">{lead.observacoes}</p>
                      </div>
                    )}
                    {(() => {
                      const sc = (lead as unknown as { score_temperatura: number | null }).score_temperatura;
                      const tp = (lead as unknown as { temperatura: "frio" | "morno" | "quente" | null }).temperatura;
                      if (sc === null || sc === undefined) return null;
                      return (
                        <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center gap-4">
                          <Termometro score={sc} temperatura={tp} size="lg" showLabel />
                          <div className="flex-1 min-w-0">
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">Temperatura do lead</div>
                            <div className="text-2xl font-bold mt-0.5">{sc}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                            <div className="text-xs text-muted-foreground mt-1">Calculado a partir das respostas do formulário</div>
                          </div>
                        </div>
                      );
                    })()}
                    {lead.is_corretor && lead.dados_corretor && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                        <div className="text-muted-foreground text-xs uppercase tracking-wide">Captação de corretor</div>
                        {Object.entries({
                          "Já é corretor": (lead.dados_corretor as Record<string, string | null>).ja_corretor,
                          "CRECI ativo": (lead.dados_corretor as Record<string, string | null>).creci_ativo,
                          "Nº CRECI": (lead.dados_corretor as Record<string, string | null>).numero_creci,
                          "Disponibilidade Barra da Tijuca": (lead.dados_corretor as Record<string, string | null>).disponibilidade_barra,
                          "Disponibilidade Recreio dos Bandeirantes": (lead.dados_corretor as Record<string, string | null>).disponibilidade_recreio,
                          "Disponibilidade Belford Roxo": (lead.dados_corretor as Record<string, string | null>).disponibilidade_belford,
                          "Disponibilidade Mesquita e Nilópolis": (lead.dados_corretor as Record<string, string | null>).disponibilidade_mesquita,
                          "Disponibilidade videochamada diária": (lead.dados_corretor as Record<string, string | null>).disponibilidade_video,
                          "Possui veículo": (lead.dados_corretor as Record<string, string | null>).possui_veiculo,
                        }).filter(([, v]) => v).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-medium text-right">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {lead.is_corretor && lead.dados_corretor && (() => {
                      const dc = lead.dados_corretor as Record<string, unknown>;
                      const fa = dc.form_answers as Record<string, string | null> | undefined;
                      if (!fa || typeof fa !== "object") return null;
                      const entries = Object.entries(fa).filter(([, v]) => v != null && String(v).trim() !== "");
                      if (entries.length === 0) return null;
                      return (
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                          <div className="text-muted-foreground text-xs uppercase tracking-wide">Respostas do formulário</div>
                          {entries.map(([k, v]) => (
                            <div key={k} className="text-sm space-y-0.5">
                              <div className="text-muted-foreground text-xs">{k}</div>
                              <div className="font-medium">{String(v)}</div>
                            </div>
                          ))}
                          {(dc.ad_name || dc.campaign_name) && (
                            <div className="pt-2 mt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                              {dc.campaign_name ? <div>Campanha: {String(dc.campaign_name)}</div> : null}
                              {dc.ad_name ? <div>Anúncio: {String(dc.ad_name)}</div> : null}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <InfoRow label="Criado em" value={format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                  </dl>
                )}

                <Separator />

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mover para etapa</Label>
                  <Select value={lead.etapa} onValueChange={(v) => changeEtapa(v as LeadRow["etapa"])}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ETAPAS.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${etapaColor(e.id).dot}`} />
                            {e.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="notas" className="space-y-3 mt-4">
                <Textarea placeholder="Adicionar nota interna..." value={nota} onChange={(e) => setNota(e.target.value)} rows={3} />
                <Button onClick={postNote} variant="gold" size="sm" disabled={!nota.trim()}>
                  <MessageSquarePlus className="h-4 w-4" /> Adicionar nota
                </Button>
                <Separator />
                <div className="space-y-2">
                  {historico.filter((h) => h.acao === "nota").map((h) => {
                    const det = h.detalhe as { nota?: string } | null;
                    return (
                      <div key={h.id} className="bg-muted/40 rounded-md p-3 text-sm">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                        <p className="whitespace-pre-wrap">{det?.nota}</p>
                      </div>
                    );
                  })}
                  {historico.filter((h) => h.acao === "nota").length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem notas ainda.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="historico" className="mt-4 space-y-2">
                {historico.map((h) => {
                  const det = h.detalhe as { motivo?: string; nota?: string; etapa?: string } | null;
                  const isDescred = h.acao === "descredenciado";
                  return (
                    <div
                      key={h.id}
                      className={`flex gap-3 text-sm border-l-2 pl-3 py-1 ${isDescred ? "border-red-500" : "border-gold/40"}`}
                    >
                      <div className="flex-1">
                        <div className={`font-medium capitalize ${isDescred ? "text-red-700 dark:text-red-300" : ""}`}>
                          {h.acao.replace(/_/g, " ")}
                        </div>
                        {isDescred && det?.motivo && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                            Motivo: {det.motivo}
                          </p>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {historico.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem histórico.</p>
                )}
              </TabsContent>
            </Tabs>
            </div>
          </>

        ) : (
          <div className="py-12 text-center text-muted-foreground">Carregando…</div>
        )}
      </SheetContent>
      <ReuniaoFormDialog
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        defaultLeadId={leadId}
        onCreated={() => { reload(); }}
      />
      <AlertDialog open={descredOpen} onOpenChange={(o) => { if (!descredLoading) setDescredOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <ShieldOff className="h-5 w-5" /> Descredenciar corretor?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove imediatamente todos os acessos de <strong>{lead?.nome}</strong> ao sistema.
              {" "}Leads de vendas ativos serão sinalizados para reatribuição manual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Motivo do descredenciamento <span className="text-red-600">*</span>
            </Label>
            <Textarea
              rows={4}
              value={descredMotivo}
              onChange={(e) => setDescredMotivo(e.target.value)}
              placeholder="Ex.: Inatividade prolongada, quebra de contrato, conduta inadequada..."
              maxLength={2000}
              autoFocus
            />
            <div className="text-[11px] text-muted-foreground text-right">{descredMotivo.length}/2000</div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descredLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDescredenciar(); }}
              disabled={descredLoading || descredMotivo.trim().length < 3}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {descredLoading ? "Descredenciando…" : "Descredenciar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}
