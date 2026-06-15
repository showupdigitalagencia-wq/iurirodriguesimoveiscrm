import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES } from "@/lib/lead-helpers";
import { VENDAS_ETAPAS, formatBRL, vendasEtapaInfo, type VendasLead, type VendasEtapa, type VendasTipo } from "@/lib/vendas-helpers";
import { toast } from "sonner";
import { MessageCircle, Trash2, Pencil, MapPin, Video } from "lucide-react";

interface Props {
  leadId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  onChanged?: () => void;
  onAgendarVisita?: (lead: VendasLead) => void;
  onReuniaoOnline?: (lead: VendasLead) => void;
}

export function VendasLeadDetail({ leadId, open, onOpenChange, isAdmin, onChanged, onAgendarVisita, onReuniaoOnline }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [savingEtapa, setSavingEtapa] = useState(false);
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

  const { data: visitas = [] } = useQuery({
    queryKey: ["vendas_lead_visitas", leadId],
    enabled: !!leadId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas_visitas" as never)
        .select("id, endereco, data_inicio, status")
        .eq("lead_id", leadId!)
        .order("data_inicio", { ascending: false });
      return (data ?? []) as { id: string; endereco: string; data_inicio: string; status: string }[];
    },
  });

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
          <DialogTitle className="flex items-center gap-2">
            {lead.nome}
            <span className={`text-xs px-2 py-0.5 rounded border ${info.color}`}>{info.emoji} {info.nome}</span>
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
              <div><span className="text-muted-foreground">Criado em:</span> {new Date(lead.created_at).toLocaleString("pt-BR")}</div>
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

          <div>
            <Label className="text-xs">Histórico de atividades</Label>
            <div className="mt-1 space-y-1 text-sm border rounded p-2 max-h-40 overflow-y-auto">
              <div className="text-xs text-muted-foreground">Lead criado em {new Date(lead.created_at).toLocaleString("pt-BR")}</div>
              {lead.atribuido_em && (
                <div className="text-xs text-muted-foreground">Atribuído em {new Date(lead.atribuido_em).toLocaleString("pt-BR")} ({lead.atribuicao_status})</div>
              )}
              {visitas.map((v) => (
                <div key={v.id} className="text-xs">
                  🏠 Visita {v.status} — {v.endereco} ({new Date(v.data_inicio).toLocaleString("pt-BR")})
                </div>
              ))}
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
              {onAgendarVisita && <Button variant="outline" size="sm" className="gap-1" onClick={() => onAgendarVisita(lead)}><MapPin className="h-3.5 w-3.5" />Agendar Visita</Button>}
              {onReuniaoOnline && <Button variant="outline" size="sm" className="gap-1" onClick={() => onReuniaoOnline(lead)}><Video className="h-3.5 w-3.5" />Reunião Online</Button>}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
              {isAdmin && <Button variant="destructive" size="sm" className="gap-1" onClick={deleteLead}><Trash2 className="h-3.5 w-3.5" />Excluir</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
