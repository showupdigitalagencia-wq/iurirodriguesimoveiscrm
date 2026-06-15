import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES } from "@/lib/lead-helpers";
import { VENDAS_ETAPAS, formatBRL, vendasEtapaInfo, type VendasLead, type VendasEtapa, type VendasTipo } from "@/lib/vendas-helpers";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas/leads")({
  component: VendasLeads,
});

function VendasLeads() {
  const qc = useQueryClient();
  const { data: leads = [] } = useQuery({
    queryKey: ["vendas_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendasLead[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateVendasLeadDialog onCreated={() => qc.invalidateQueries({ queryKey: ["vendas_leads"] })} />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Nome</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Etapa</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum lead ainda</td></tr>
            )}
            {leads.map((l) => {
              const info = vendasEtapaInfo(l.etapa);
              return (
                <tr key={l.id} className="border-t">
                  <td className="p-3 font-medium">{l.nome}</td>
                  <td className="p-3">{l.tipo === "compra" ? "Compra" : "Locação"}</td>
                  <td className="p-3">{l.telefone}</td>
                  <td className="p-3">{formatBRL(l.valor != null ? Number(l.valor) : null)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${info.color}`}>
                      {info.emoji} {info.nome}
                    </span>
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

function CreateVendasLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "",
    tipo: "compra" as VendasTipo,
    regiao: "barra_da_tijuca",
    valor: "",
    observacoes: "",
    etapa: "novo_lead" as VendasEtapa,
  });

  async function submit() {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id;
      const { error } = await supabase.from("vendas_leads").insert({
        nome: form.nome.trim(),
        telefone: form.telefone.replace(/\D/g, ""),
        email: form.email.trim() || null,
        tipo: form.tipo,
        regiao: form.regiao as never,
        valor: form.valor ? Number(form.valor.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        observacoes: form.observacoes.trim() || null,
        etapa: form.etapa,
        corretor_id: uid ?? null,
        created_by: uid ?? null,
      });
      if (error) throw error;
      toast.success("Lead cadastrado");
      setOpen(false);
      setForm({ nome: "", telefone: "", email: "", tipo: "compra", regiao: "barra_da_tijuca", valor: "", observacoes: "", etapa: "novo_lead" });
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

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
                  {VENDAS_ETAPAS.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.emoji} {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
