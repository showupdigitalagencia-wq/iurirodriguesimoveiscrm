import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Contrato = Database["public"]["Tables"]["contratos"]["Row"];
type ContratoInsert = Database["public"]["Tables"]["contratos"]["Insert"];
type Imovel = Database["public"]["Tables"]["imoveis"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/contratos")({
  component: ContratosPage,
});

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo", vencendo: "Vencendo", encerrado: "Encerrado", rescindido: "Rescindido",
};
const STATUS_COLOR: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  vencendo: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  encerrado: "bg-muted text-muted-foreground",
  rescindido: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function formatBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}
function diasRestantes(dataFim: string) {
  return Math.ceil((new Date(dataFim).getTime() - Date.now()) / 86400000);
}

function ContratosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [open, setOpen] = useState(false);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*").order("data_fim", { ascending: true });
      if (error) throw error;
      return data as Contrato[];
    },
  });
  const { data: imoveis = [] } = useQuery({
    queryKey: ["imoveis_for_contrato"],
    queryFn: async () => {
      const { data, error } = await supabase.from("imoveis").select("id,tipo,rua,numero,bairro").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pick<Imovel, "id" | "tipo" | "rua" | "numero" | "bairro">[];
    },
  });
  const imovelLabel = (id: string) => {
    const i = imoveis.find((m) => m.id === id);
    if (!i) return id.slice(0, 8);
    return `${i.tipo} — ${i.rua}${i.numero ? ", " + i.numero : ""}${i.bairro ? " (" + i.bairro + ")" : ""}`;
  };

  async function remove(id: string) {
    if (!confirm("Excluir este contrato?")) return;
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contrato excluído");
    qc.invalidateQueries({ queryKey: ["contratos"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{contratos.length} contrato{contratos.length === 1 ? "" : "s"}</div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={imoveis.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Novo Contrato
        </Button>
      </div>

      {imoveis.length === 0 && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Cadastre um imóvel antes de criar contratos.</CardContent></Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : contratos.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum contrato cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {contratos.map((c) => {
            const dias = diasRestantes(c.data_fim);
            const alerta = (c.status === "ativo" || c.status === "vencendo") && dias <= 90 && dias >= 0;
            const corAlerta = dias <= 30 ? "text-destructive" : dias <= 60 ? "text-amber-600" : "text-muted-foreground";
            return (
              <Card key={c.id} className="cursor-pointer hover:border-gold/50" onClick={() => { setEditing(c); setOpen(true); }}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{c.locatario_nome}</div>
                      <div className="text-xs text-muted-foreground truncate">{imovelLabel(c.imovel_id)}</div>
                    </div>
                    <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Início:</span> {new Date(c.data_inicio).toLocaleDateString("pt-BR")}</div>
                    <div><span className="text-muted-foreground">Fim:</span> {new Date(c.data_fim).toLocaleDateString("pt-BR")}</div>
                    <div><span className="text-muted-foreground">Aluguel:</span> {formatBRL(c.valor_aluguel)}</div>
                    <div><span className="text-muted-foreground">Vence dia:</span> {c.dia_vencimento ?? "-"}</div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    {alerta ? (
                      <span className={`inline-flex items-center gap-1 text-xs ${corAlerta}`}>
                        <AlertTriangle className="h-3 w-3" /> Vence em {dias} dia{dias === 1 ? "" : "s"}
                      </span>
                    ) : <span />}
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(c); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ContratoDialog
        open={open}
        onOpenChange={setOpen}
        contrato={editing}
        imoveis={imoveis}
        onSaved={() => qc.invalidateQueries({ queryKey: ["contratos"] })}
      />
    </div>
  );
}

function ContratoDialog({ open, onOpenChange, contrato, imoveis, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; contrato: Contrato | null;
  imoveis: Pick<Imovel, "id" | "tipo" | "rua" | "numero" | "bairro">[]; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ContratoInsert>>({});

  useEffect(() => {
    if (!open) return;
    setForm(contrato ? { ...contrato } : {
      imovel_id: imoveis[0]?.id, locatario_nome: "", data_inicio: new Date().toISOString().slice(0, 10),
      data_fim: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      duracao_meses: 12, valor_aluguel: 0, dia_vencimento: 10, status: "ativo",
    });
  }, [open, contrato, imoveis]);
  function set<K extends keyof ContratoInsert>(k: K, v: ContratoInsert[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.imovel_id || !form.locatario_nome || !form.data_inicio || !form.data_fim) {
      toast.error("Preencha imóvel, locatário e datas");
      return;
    }
    setSaving(true);
    const { data: ud } = await supabase.auth.getUser();
    const payload = { ...form, created_by: contrato?.created_by ?? ud.user?.id } as ContratoInsert;
    const q = contrato
      ? supabase.from("contratos").update(payload).eq("id", contrato.id)
      : supabase.from("contratos").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(contrato ? "Contrato atualizado" : "Contrato cadastrado");
    onOpenChange(false);
    setForm({});
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{contrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Imóvel *</Label>
            <Select value={form.imovel_id ?? ""} onValueChange={(v) => set("imovel_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {imoveis.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.tipo} — {i.rua}{i.numero ? ", " + i.numero : ""}{i.bairro ? ` (${i.bairro})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 border-t pt-3"><h3 className="font-semibold text-sm">Locatário</h3></div>
          <div><Label>Nome completo *</Label><Input value={form.locatario_nome ?? ""} onChange={(e) => set("locatario_nome", e.target.value)} /></div>
          <div><Label>CPF</Label><Input value={form.locatario_cpf ?? ""} onChange={(e) => set("locatario_cpf", e.target.value)} /></div>
          <div><Label>RG</Label><Input value={form.locatario_rg ?? ""} onChange={(e) => set("locatario_rg", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={form.locatario_telefone ?? ""} onChange={(e) => set("locatario_telefone", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.locatario_email ?? ""} onChange={(e) => set("locatario_email", e.target.value)} /></div>
          <div><Label>Endereço anterior</Label><Input value={form.endereco_anterior ?? ""} onChange={(e) => set("endereco_anterior", e.target.value)} /></div>

          <div className="md:col-span-2 border-t pt-3"><h3 className="font-semibold text-sm">Contrato</h3></div>
          <div><Label>Início *</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value)} /></div>
          <div><Label>Vencimento *</Label><Input type="date" value={form.data_fim ?? ""} onChange={(e) => set("data_fim", e.target.value)} /></div>
          <div><Label>Duração (meses)</Label><Input type="number" value={form.duracao_meses ?? 12} onChange={(e) => set("duracao_meses", Number(e.target.value))} /></div>
          <div><Label>Valor do aluguel (R$)</Label><Input type="number" step="0.01" value={form.valor_aluguel ?? 0} onChange={(e) => set("valor_aluguel", Number(e.target.value))} /></div>
          <div>
            <Label>Índice de reajuste</Label>
            <Select value={form.indice_reajuste ?? ""} onValueChange={(v) => set("indice_reajuste", v || null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="igpm">IGPM</SelectItem>
                <SelectItem value="ipca">IPCA</SelectItem>
                <SelectItem value="inpc">INPC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Dia do vencimento do boleto</Label><Input type="number" min={1} max={31} value={form.dia_vencimento ?? 10} onChange={(e) => set("dia_vencimento", Number(e.target.value))} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
