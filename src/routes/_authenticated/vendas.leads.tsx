import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES } from "@/lib/lead-helpers";
import { VENDAS_ETAPAS, formatBRL, vendasEtapaInfo, type VendasLead, type VendasEtapa, type VendasTipo } from "@/lib/vendas-helpers";
import { createVisita, createReuniaoOnlineVenda } from "@/lib/visitas.functions";
import { listCorretoresDisponibilidade, atribuirLead, aceitarLead, recusarLead, type CorretorAvail } from "@/lib/vendas-distribuicao.functions";
import { createManualVendasLead } from "@/lib/vendas-manual.functions";
import { getPlantonistaHoje, listCorretoresElegiveis } from "@/lib/plantao.functions";
import { toast } from "sonner";
import { Plus, MapPin, Video, UserPlus, Check, X } from "lucide-react";
import { VendasLeadDetail } from "@/components/vendas-lead-detail";

type VendasLeadExt = VendasLead & {
  atribuicao_status?: "pendente" | "aceito" | "recusado" | null;
  atribuido_em?: string | null;
  recusas?: string[] | null;
};

export const Route = createFileRoute("/_authenticated/vendas/leads")({
  component: VendasLeads,
});

function VendasLeads() {
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me_vendas_ctx"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id ?? null;
      if (!uid) return { uid: null, isAdmin: false };
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return { uid, isAdmin: roles?.some((r) => r.role === "admin") ?? false };
    },
  });
  const isAdmin = me?.isAdmin ?? false;
  const myUid = me?.uid ?? null;

  const { data: leads = [] } = useQuery({
    queryKey: ["vendas_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendasLeadExt[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendas_leads"] });

  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateVendasLeadDialog onCreated={invalidate} />
      </div>
      <VendasLeadDetail leadId={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} isAdmin={isAdmin} onChanged={invalidate} />

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Nome</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Atribuição</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum lead ainda</td></tr>
            )}
            {leads.map((l) => {
              const info = vendasEtapaInfo(l.etapa);
              const isMyPending = l.corretor_id === myUid && l.atribuicao_status === "pendente";
              return (
                <tr key={l.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDetailId(l.id)}>
                  <td className="p-3 font-medium underline-offset-2 hover:underline">{l.nome}</td>
                  <td className="p-3">{l.tipo === "compra" ? "Compra" : "Locação"}</td>
                  <td className="p-3">{l.telefone}</td>
                  <td className="p-3">{formatBRL(l.valor != null ? Number(l.valor) : null)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${info.color}`}>
                      {info.emoji} {info.nome}
                    </span>
                  </td>
                  <td className="p-3">
                    {!l.corretor_id ? (
                      <span className="text-xs text-muted-foreground">— Sem corretor</span>
                    ) : l.atribuicao_status === "pendente" ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-yellow-500/15 text-yellow-700 border-yellow-300">⏳ Aguardando aceite</span>
                    ) : l.atribuicao_status === "aceito" ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-green-600/15 text-green-700 border-green-300">✅ Aceito</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Atribuído</span>
                    )}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-end flex-wrap">
                      {isAdmin && (
                        <AtribuirLeadButton lead={l} onDone={invalidate} />
                      )}
                      {isMyPending && (
                        <AceitarRecusarButtons leadId={l.id} onDone={invalidate} />
                      )}
                      <AgendarVisitaButton lead={l} onDone={invalidate} />
                      <ReuniaoOnlineButton lead={l} onDone={invalidate} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AtribuirLeadButton({ lead, onDone }: { lead: VendasLeadExt; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const listFn = useServerFn(listCorretoresDisponibilidade);
  const assignFn = useServerFn(atribuirLead);
  const { data: corretores = [], refetch, isFetching } = useQuery({
    queryKey: ["corretores_disp", lead.id, open],
    enabled: open,
    queryFn: async () => {
      const r = await listFn({ data: { lead_id: lead.id } });
      return r.items as CorretorAvail[];
    },
  });

  async function assign(corretorId: string) {
    setSaving(corretorId);
    try {
      await assignFn({ data: { lead_id: lead.id, corretor_id: corretorId } });
      toast.success("Lead atribuído. Notificação enviada ao corretor.");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atribuir");
    } finally { setSaving(null); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><UserPlus className="h-3.5 w-3.5" />Atribuir</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Atribuir lead — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
          {isFetching && <p className="text-xs text-muted-foreground">Carregando corretores...</p>}
          {!isFetching && corretores.length === 0 && <p className="text-xs text-muted-foreground">Nenhum corretor cadastrado</p>}
          {corretores.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded p-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.nome}</div>
                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                  <span className={c.disponivel_agora ? "text-green-600" : "text-muted-foreground"}>
                    {c.disponivel_agora ? "🟢 Disponível agora" : "⚪ Fora do horário"}
                  </span>
                  <span>· {c.leads_ativos} leads ativos</span>
                  {c.recusou && <span className="text-red-600">· já recusou este lead</span>}
                </div>
              </div>
              <Button size="sm" variant="gold" disabled={saving === c.id} onClick={() => assign(c.id)}>
                {saving === c.id ? "..." : "Atribuir"}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => refetch()}>Atualizar</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AceitarRecusarButtons({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [motivoOpen, setMotivoOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const aceitarFn = useServerFn(aceitarLead);
  const recusarFn = useServerFn(recusarLead);

  async function aceitar() {
    setBusy(true);
    try { await aceitarFn({ data: { lead_id: leadId } }); toast.success("Lead aceito"); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }
  async function recusar() {
    setBusy(true);
    try { await recusarFn({ data: { lead_id: leadId, motivo: motivo.trim() || undefined } }); toast.success("Lead devolvido ao executivo"); setMotivoOpen(false); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" variant="default" className="gap-1 bg-green-600 hover:bg-green-700" disabled={busy} onClick={aceitar}>
        <Check className="h-3.5 w-3.5" />Aceitar
      </Button>
      <Dialog open={motivoOpen} onOpenChange={setMotivoOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" className="gap-1" disabled={busy}><X className="h-3.5 w-3.5" />Recusar</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Recusar lead</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: estou sem disponibilidade hoje" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotivoOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={recusar} disabled={busy}>Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AgendarVisitaButton({ lead, onDone }: { lead: VendasLead; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return toLocalInputValue(d);
  });
  const [duracao, setDuracao] = useState(60);
  const [observacoes, setObservacoes] = useState("");
  const createVisitaFn = useServerFn(createVisita);

  async function submit() {
    if (!endereco.trim()) { toast.error("Informe o endereço"); return; }
    const { confirmNoGoogleConflict } = await import("@/lib/google-conflict");
    if (!(await confirmNoGoogleConflict(new Date(dataInicio).toISOString(), duracao))) return;
    setSaving(true);
    try {
      await createVisitaFn({ data: {
        lead_id: lead.id,
        endereco: endereco.trim(),
        data_inicio: new Date(dataInicio).toISOString(),
        duracao_min: duracao,
        observacoes: observacoes.trim() || undefined,
      } });
      toast.success("Visita agendada");
      // WhatsApp confirmação
      const dt = new Date(dataInicio);
      const dataBR = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const horaBR = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      const msg = `Olá ${lead.nome}! Confirmando sua visita ao imóvel em ${endereco.trim()} no dia ${dataBR} às ${horaBR}. Iuri Rodrigues Imóveis 🏢`;
      const tel = (lead.telefone ?? "").replace(/\D/g, "");
      if (tel) window.open(`https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(msg)}`, "_blank");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao agendar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><MapPin className="h-3.5 w-3.5" />Agendar Visita</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agendar visita — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Endereço do imóvel *</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, nº, bairro" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data e hora</Label><Input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 60)} /></div>
          </div>
          <div><Label>Observações</Label><Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReuniaoOnlineButton({ lead, onDone }: { lead: VendasLead; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return toLocalInputValue(d);
  });
  const [duracao, setDuracao] = useState(45);
  const [observacoes, setObservacoes] = useState("");
  const createReuniaoFn = useServerFn(createReuniaoOnlineVenda);

  async function submit() {
    const { confirmNoGoogleConflict } = await import("@/lib/google-conflict");
    if (!(await confirmNoGoogleConflict(new Date(dataInicio).toISOString(), duracao))) return;
    setSaving(true);
    try {
      const res = await createReuniaoFn({ data: {
        lead_id: lead.id,
        data_inicio: new Date(dataInicio).toISOString(),
        duracao_min: duracao,
        observacoes: observacoes.trim() || undefined,
      } });
      if (res.meetLink) {
        toast.success("Reunião criada no Google Meet");
      } else {
        toast.warning("Reunião registrada, mas o Google Meet não pôde ser criado. Conecte o Google na Agenda.");
      }
      const dt = new Date(dataInicio);
      const dataBR = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const horaBR = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      const linkPart = res.meetLink ? `\n📍 Link: ${res.meetLink}` : "";
      const msg = `Olá ${lead.nome}! Sua reunião online está confirmada para ${dataBR} às ${horaBR}.${linkPart}\n\nIuri Rodrigues Imóveis 🏢`;
      const tel = (lead.telefone ?? "").replace(/\D/g, "");
      if (tel) window.open(`https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(msg)}`, "_blank");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar reunião");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Video className="h-3.5 w-3.5" />Reunião Online</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reunião online — {lead.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data e hora</Label><Input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 45)} /></div>
          </div>
          <div><Label>Pauta / observações</Label><Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Será criado um evento com Google Meet no seu calendário. Conecte o Google em Vendas → Agenda se ainda não conectou.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Criando..." : "Criar reunião"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateVendasLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const createManual = useServerFn(createManualVendasLead);
  const getPlantonista = useServerFn(getPlantonistaHoje);
  const listElegiveis = useServerFn(listCorretoresElegiveis);

  const { data: me } = useQuery({
    queryKey: ["me_create_lead_ctx"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id ?? null;
      if (!uid) return { uid: null, isAdmin: false };
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return { uid, isAdmin: roles?.some((r) => r.role === "admin") ?? false };
    },
  });
  const isAdmin = me?.isAdmin ?? false;

  const { data: plantonista } = useQuery({
    queryKey: ["plantonista_hoje_create_lead"],
    enabled: open,
    queryFn: async () => getPlantonista(),
  });

  const { data: elegiveis } = useQuery({
    queryKey: ["corretores_elegiveis_create_lead"],
    enabled: open && isAdmin,
    queryFn: async () => listElegiveis(),
  });

  const [form, setForm] = useState({
    nome: "", telefone: "", email: "",
    tipo: "compra" as VendasTipo,
    regiao: "barra_da_tijuca",
    valor: "",
    observacoes: "",
    etapa: "novo_lead" as VendasEtapa,
    corretor_id: "" as string, // admin override
  });

  // Pré-preenche o "Atribuir a" com o plantonista do dia
  const plantonistaId = plantonista?.corretor_id ?? null;
  const plantonistaNome = plantonista?.corretor_nome ?? null;
  if (open && plantonistaId && !form.corretor_id && isAdmin) {
    // set once
    setTimeout(() => setForm((f) => (f.corretor_id ? f : { ...f, corretor_id: plantonistaId })), 0);
  }

  async function submit() {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await createManual({
        data: {
          nome: form.nome.trim(),
          telefone: form.telefone,
          email: form.email.trim() || null,
          tipo: form.tipo,
          regiao: form.regiao,
          valor: form.valor ? Number(form.valor.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
          observacoes: form.observacoes.trim() || null,
          etapa: form.etapa,
          corretor_id_override: isAdmin && form.corretor_id ? form.corretor_id : null,
        },
      });
      toast.success("Lead cadastrado");
      setOpen(false);
      setForm({ nome: "", telefone: "", email: "", tipo: "compra", regiao: "barra_da_tijuca", valor: "", observacoes: "", etapa: "novo_lead", corretor_id: "" });
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  const sugestaoLabel = plantonistaNome
    ? `${plantonistaNome} (plantonista de hoje)`
    : "Sem plantonista escalado — será atribuído aos administradores";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold"><Plus className="h-4 w-4" /> Cadastrar Lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo lead de vendas</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Telefone *</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as VendasTipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="locacao">Locação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Região</Label>
              <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Valor (R$)</Label><Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="500000" /></div>
            <div>
              <Label>Etapa</Label>
              <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v as VendasEtapa })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDAS_ETAPAS.filter((e) => e.id !== "fechado").map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.emoji} {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Atribuir a</Label>
            {isAdmin ? (
              <Select
                value={form.corretor_id || (plantonistaId ?? "")}
                onValueChange={(v) => setForm({ ...form, corretor_id: v })}
              >
                <SelectTrigger><SelectValue placeholder={sugestaoLabel} /></SelectTrigger>
                <SelectContent>
                  {plantonistaId && (
                    <SelectItem value={plantonistaId}>{plantonistaNome ?? "Plantonista"} (plantão de hoje)</SelectItem>
                  )}
                  {(elegiveis?.items ?? [])
                    .filter((c: { id: string }) => c.id !== plantonistaId)
                    .map((c: { id: string; nome: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={sugestaoLabel} disabled readOnly />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Por padrão, os leads manuais são atribuídos ao plantonista do dia.
            </p>
            {isAdmin && plantonistaId && form.corretor_id && form.corretor_id !== plantonistaId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Responsável alterado manualmente por administrador.
              </p>
            )}
          </div>

          <div><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

