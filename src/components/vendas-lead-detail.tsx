import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES } from "@/lib/lead-helpers";
import { VENDAS_ETAPAS, formatBRL, vendasEtapaInfo, type VendasLead, type VendasEtapa, type VendasTipo } from "@/lib/vendas-helpers";
import { createVisita, createReuniaoOnlineVenda, listImoveisForVisita, confirmarVisita, type ImovelOption } from "@/lib/visitas.functions";
import { formatImovelEndereco, formatImovelOptionLabel, buildVisitaConfirmacaoMsg } from "@/lib/visita-helpers";

import { getFinanciamentoStatusByLead, type FinanciamentoStatus } from "@/lib/financiamento.functions";
import { toast } from "sonner";
import { MessageCircle, Trash2, Pencil, MapPin, Video, Banknote, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { FecharLeadDialog } from "@/components/fechar-lead-dialog";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  leadId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  onChanged?: () => void;
}

export function VendasLeadDetail({ leadId, open, onOpenChange, isAdmin, onChanged }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [savingEtapa, setSavingEtapa] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [form, setForm] = useState<Partial<VendasLead>>({});

  const { data: lead, refetch } = useQuery({
    queryKey: ["vendas_lead_detail", leadId],
    enabled: !!leadId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendas_leads").select("*").eq("id", leadId!).maybeSingle();
      if (error) throw error;
      return data as VendasLead | null;
    },
  });

  const { data: visitas = [], refetch: refetchVisitas } = useQuery({
    queryKey: ["vendas_lead_visitas", leadId],
    enabled: !!leadId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas_visitas" as never)
        .select("id, endereco, data_inicio, status, comparecimento")
        .eq("lead_id", leadId!)
        .order("data_inicio", { ascending: false });
      return (data ?? []) as { id: string; endereco: string; data_inicio: string; status: string; comparecimento: "realizada" | "nao_compareceu" | null }[];
    },
  });

  const confirmarVisitaFn = useServerFn(confirmarVisita);
  const visitasPendentes = visitas.filter((v) => v.comparecimento == null && new Date(v.data_inicio) < new Date());
  async function handleConfirmar(visitaId: string, comparecimento: "realizada" | "nao_compareceu") {
    try {
      await confirmarVisitaFn({ data: { visita_id: visitaId, comparecimento } });
      toast.success(comparecimento === "realizada" ? "Visita marcada como realizada" : "Visita marcada como não compareceu");
      refetchVisitas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar visita");
    }
  }

  const getFinStatus = useServerFn(getFinanciamentoStatusByLead);
  const { data: finStatus } = useQuery({
    queryKey: ["lead_financiamento_status", leadId],
    enabled: !!leadId && open,
    queryFn: () => getFinStatus({ data: { leadId: leadId! } }),
  });

  const { data: isExec } = useQuery({
    queryKey: ["me-is-executivo"],
    queryFn: async () => {
      const { data } = await supabase.rpc("current_user_is_executivo");
      return data === true;
    },
  });
  const canEnviarFinanciamento = isAdmin || !!isExec;

  useEffect(() => {
    if (lead && !editing) setForm(lead);
  }, [lead, editing]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["vendas_leads"] });
    qc.invalidateQueries({ queryKey: ["vendas_leads_pipeline"] });
    qc.invalidateQueries({ queryKey: ["vendas_lead_detail", leadId] });
    onChanged?.();
  }

  async function changeEtapa(etapa: VendasEtapa) {
    if (!lead) return;
    // Fechamento exige modal com seleção de imóvel + cálculo de comissão
    if (etapa === "fechado") {
      setFecharOpen(true);
      return;
    }
    setSavingEtapa(true);
    try {
      const { error } = await supabase.from("vendas_leads").update({ etapa }).eq("id", lead.id);
      if (error) throw error;
      toast.success("Etapa atualizada");
      invalidate();
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingEtapa(false);
    }
  }

  async function saveEdit() {
    if (!lead || !form) return;
    try {
      const { error } = await supabase.from("vendas_leads").update({
        nome: form.nome ?? lead.nome,
        telefone: (form.telefone ?? lead.telefone).replace(/\D/g, ""),
        email: form.email ?? null,
        tipo: (form.tipo ?? lead.tipo) as VendasTipo,
        regiao: (form.regiao ?? lead.regiao) as never,
        valor: form.valor != null ? Number(form.valor) : null,
        observacoes: form.observacoes ?? null,
      }).eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead atualizado");
      setEditing(false);
      invalidate();
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function deleteLead() {
    if (!lead) return;
    if (!confirm(`Excluir lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from("vendas_leads").delete().eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead excluído");
      onOpenChange(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  function openWhatsApp() {
    if (!lead) return;
    const tel = (lead.telefone ?? "").replace(/\D/g, "");
    if (!tel) { toast.error("Sem telefone"); return; }
    const msg = `Olá ${lead.nome}! Sou da Iuri Rodrigues Imóveis 🏢`;
    window.open(`https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!lead) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Carregando...</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  const info = vendasEtapaInfo(lead.etapa);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {lead.nome}
            <span className={`text-xs px-2 py-0.5 rounded border ${info.color}`}>{info.emoji} {info.nome}</span>
            {finStatus?.status && <FinanciamentoBadge status={finStatus.status} />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!editing ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Telefone:</span> {lead.telefone}</div>
              <div><span className="text-muted-foreground">Email:</span> {lead.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Tipo:</span> {lead.tipo === "compra" ? "Compra" : "Locação"}</div>
              <div><span className="text-muted-foreground">Região:</span> {String(lead.regiao).replace(/_/g, " ")}</div>
              <div><span className="text-muted-foreground">Valor:</span> {formatBRL(lead.valor != null ? Number(lead.valor) : null)}</div>
              <div><span className="text-muted-foreground">Criado em:</span> {new Date(lead.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
              {lead.observacoes && <div className="col-span-2"><span className="text-muted-foreground">Observações:</span> {lead.observacoes}</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo ?? "compra"} onValueChange={(v) => setForm({ ...form, tipo: v as VendasTipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Região</Label>
                  <Select value={String(form.regiao ?? "barra_da_tijuca")} onValueChange={(v) => setForm({ ...form, regiao: v as never })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" value={form.valor != null ? String(form.valor) : ""} onChange={(e) => setForm({ ...form, valor: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label>Observações</Label><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            </div>
          )}

          <div>
            <Label className="text-xs">Mover para etapa</Label>
            <Select value={lead.etapa} onValueChange={(v) => changeEtapa(v as VendasEtapa)} disabled={savingEtapa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENDAS_ETAPAS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.emoji} {e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lead.etapa === "fechado" && (
            <div className={`rounded-lg border p-3 ${lead.comissao != null ? "border-gold/40 bg-gold/5" : "border-amber-500/40 bg-amber-500/10"}`}>
              {lead.comissao != null ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Comissão calculada</div>
                    <div className="text-lg font-bold text-gold">{formatBRL(Number(lead.comissao))}</div>
                    {lead.fechado_em && (
                      <div className="text-[10px] text-muted-foreground">
                        Fechado em {new Date(lead.fechado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setFecharOpen(true)}>Recalcular</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">Receita não calculada</div>
                      <div className="text-xs text-muted-foreground">Vincule o imóvel para calcular a comissão (legado).</div>
                    </div>
                  </div>
                  <Button size="sm" variant="gold" onClick={() => setFecharOpen(true)}>Preencher</Button>
                </div>
              )}
            </div>
          )}

          {visitasPendentes.length > 0 && (
            <div className="space-y-2">
              {visitasPendentes.map((v) => (
                <div key={v.id} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    Como foi a visita de {new Date(v.data_inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}?
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2 truncate">{v.endereco}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="gold" className="gap-1 h-7 text-xs" onClick={() => handleConfirmar(v.id, "realizada")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Realizada
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleConfirmar(v.id, "nao_compareceu")}>
                      <XCircle className="h-3.5 w-3.5" /> Não compareceu
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label className="text-xs">Histórico de atividades</Label>
            <div className="mt-1 space-y-1 text-sm border rounded p-2 max-h-40 overflow-y-auto">
              <div className="text-xs text-muted-foreground">Lead criado em {new Date(lead.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
              {lead.atribuido_em && (
                <div className="text-xs text-muted-foreground">Atribuído em {new Date(lead.atribuido_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ({lead.atribuicao_status})</div>
              )}
              {visitas.map((v) => {
                const compLabel = v.comparecimento === "realizada" ? " ✅ realizada"
                  : v.comparecimento === "nao_compareceu" ? " ❌ não compareceu"
                  : "";
                return (
                  <div key={v.id} className="text-xs">
                    🏠 Visita {v.status}{compLabel} — {v.endereco} ({new Date(v.data_inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })})
                  </div>
                );
              })}
              {visitas.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma visita registrada</div>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setForm(lead); }}>Cancelar</Button>
              <Button variant="gold" onClick={saveEdit}>Salvar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={openWhatsApp}><MessageCircle className="h-3.5 w-3.5" />WhatsApp</Button>
              <AgendarVisitaInline lead={lead} onDone={() => { invalidate(); refetch(); }} />
              <ReuniaoOnlineInline lead={lead} onDone={() => { invalidate(); refetch(); }} />
              {lead.tipo === "compra" && <EnviarFinanciamentoInline lead={lead} />}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
              {isAdmin && <Button variant="destructive" size="sm" className="gap-1" onClick={deleteLead}><Trash2 className="h-3.5 w-3.5" />Excluir</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <FecharLeadDialog
        open={fecharOpen}
        onOpenChange={setFecharOpen}
        leadId={lead.id}
        leadNome={lead.nome}
        tipo={lead.tipo as VendasTipo}
        onFechado={() => { invalidate(); refetch(); }}
      />
    </Dialog>
  );
}

function AgendarVisitaInline({ lead, onDone }: { lead: VendasLead; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imovelId, setImovelId] = useState<string>("");
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return toLocalInputValue(d); });
  const [duracao, setDuracao] = useState(60);
  const [observacoes, setObservacoes] = useState("");
  const fn = useServerFn(createVisita);
  const listImoveis = useServerFn(listImoveisForVisita);

  const { data: imoveisData } = useQuery({
    queryKey: ["imoveis_for_visita"],
    enabled: open,
    queryFn: () => listImoveis(),
  });
  const imoveis: ImovelOption[] = imoveisData?.items ?? [];

  function onSelectImovel(id: string) {
    setImovelId(id);
    const im = imoveis.find((x) => x.id === id);
    if (im) setEndereco(formatImovelEndereco(im));
  }

  async function submit() {
    if (!endereco.trim()) { toast.error("Selecione um imóvel ou informe o endereço"); return; }
    const { confirmNoGoogleConflict } = await import("@/lib/google-conflict");
    if (!(await confirmNoGoogleConflict(new Date(dataInicio).toISOString(), duracao))) return;
    setSaving(true);
    try {
      await fn({ data: { lead_id: lead.id, endereco: endereco.trim(), imovel_id: imovelId || null, data_inicio: new Date(dataInicio).toISOString(), duracao_min: duracao, observacoes: observacoes.trim() || undefined } });
      toast.success("Visita agendada");
      const dt = new Date(dataInicio);
      const msg = buildVisitaConfirmacaoMsg({
        nome: lead.nome,
        endereco: endereco.trim(),
        dataFmt: dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        horaFmt: dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
      });
      const tel = (lead.telefone ?? "").replace(/\D/g, "");
      if (tel) window.open(`https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(msg)}`, "_blank");
      setOpen(false); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><MapPin className="h-3.5 w-3.5" />Agendar Visita</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agendar visita — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Imóvel do portfólio (opcional)</Label>
            <Select value={imovelId || "__none__"} onValueChange={(v) => v === "__none__" ? (setImovelId(""), setEndereco("")) : onSelectImovel(v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione um imóvel..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum (digitar endereço) —</SelectItem>
                {imoveis.map((im) => (
                  <SelectItem key={im.id} value={im.id}>{formatImovelOptionLabel(im)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Endereço *</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" />
            <p className="text-xs text-muted-foreground mt-1">Preenchido ao selecionar o imóvel, ou digite manualmente.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data/hora</Label><Input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 60)} /></div>
          </div>
          <div><Label>Observações</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "..." : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ReuniaoOnlineInline({ lead, onDone }: { lead: VendasLead; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return toLocalInputValue(d); });
  const [duracao, setDuracao] = useState(45);
  const [observacoes, setObservacoes] = useState("");
  const fn = useServerFn(createReuniaoOnlineVenda);

  async function submit() {
    const { confirmNoGoogleConflict } = await import("@/lib/google-conflict");
    if (!(await confirmNoGoogleConflict(new Date(dataInicio).toISOString(), duracao))) return;
    setSaving(true);
    try {
      const res = await fn({ data: { lead_id: lead.id, data_inicio: new Date(dataInicio).toISOString(), duracao_min: duracao, observacoes: observacoes.trim() || undefined } });
      toast.success(res.meetLink ? "Reunião criada" : "Reunião registrada (sem Meet)");
      const dt = new Date(dataInicio);
      const linkPart = res.meetLink ? `\n📍 Link: ${res.meetLink}` : "";
      const msg = `Olá ${lead.nome}! Sua reunião online está confirmada para ${dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.${linkPart}\n\nIuri Rodrigues Imóveis 🏢`;
      const tel = (lead.telefone ?? "").replace(/\D/g, "");
      if (tel) window.open(`https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(msg)}`, "_blank");
      setOpen(false); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><Video className="h-3.5 w-3.5" />Reunião Online</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reunião online — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data/hora</Label><Input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 45)} /></div>
          </div>
          <div><Label>Pauta</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIN_BADGE: Record<FinanciamentoStatus, { label: string; cls: string; emoji: string }> = {
  pendente: { label: "Financ. Pendente", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", emoji: "⏳" },
  em_analise: { label: "Financ. Em Análise", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30", emoji: "🔎" },
  aprovado: { label: "Financ. Aprovado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", emoji: "✅" },
  recusado: { label: "Financ. Recusado", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", emoji: "❌" },
};

function FinanciamentoBadge({ status }: { status: FinanciamentoStatus }) {
  const b = FIN_BADGE[status];
  return <span className={`text-xs px-2 py-0.5 rounded border ${b.cls}`}>{b.emoji} {b.label}</span>;
}

function EnviarFinanciamentoInline({ lead }: { lead: VendasLead }) {
  const [open, setOpen] = useState(false);
  const url = `https://sistemanexus.app/financiamento?lead=${lead.id}`;
  const mensagem = `Olá ${lead.nome}! 👋\n\nPra dar sequência no seu financiamento, preencha o formulário e envie a documentação por este link:\n\n${url}\n\nQualquer dúvida estou à disposição. Iuri Rodrigues Imóveis 🏢`;

  function copyLink() {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  function openWa() {
    const tel = (lead.telefone ?? "").replace(/\D/g, "");
    if (!tel) { toast.error("Sem telefone"); return; }
    const phone = tel.length <= 11 ? "55" + tel : tel;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Banknote className="h-3.5 w-3.5" />Enviar para Financiamento</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Financiamento — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p className="text-muted-foreground">
            Compartilhe o link abaixo com o cliente. Ele vai abrir uma página personalizada para enviar a documentação para análise da nossa correspondente bancária.
          </p>
          <div>
            <Label className="text-xs">Link personalizado</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={copyLink} className="gap-1 shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button variant="gold" onClick={openWa} className="gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
