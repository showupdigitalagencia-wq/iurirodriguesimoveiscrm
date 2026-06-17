import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Contrato = Database["public"]["Tables"]["contratos"]["Row"];
// pagamentos table is new — types may not be regenerated yet
type Pagamento = {
  id: string;
  contrato_id: string;
  mes_referencia: string;
  valor_previsto: number;
  valor_pago: number | null;
  data_pagamento: string | null;
  multa: number | null;
  juros: number | null;
  status: "pago" | "atrasado" | "pendente" | "inadimplente";
  observacoes: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/pagamentos")({
  component: PagamentosPage,
});

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pago: { label: "Pago", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  atrasado: { label: "Atrasado", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  inadimplente: { label: "Inadimplente", color: "bg-rose-500/10 text-rose-700 dark:text-rose-400", icon: XCircle },
};

function formatBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}
function monthLabel(d: string) {
  const [y, m] = d.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function PagamentosPage() {
  const qc = useQueryClient();
  const [contratoId, setContratoId] = useState<string>("");
  const [editing, setEditing] = useState<Pagamento | null>(null);
  const [open, setOpen] = useState(false);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos_for_pag"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*").order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Contrato[];
    },
  });

  useEffect(() => {
    if (!contratoId && contratos.length) setContratoId(contratos[0].id);
  }, [contratos, contratoId]);

  const contrato = contratos.find((c) => c.id === contratoId);

  const { data: pagamentos = [], refetch } = useQuery({
    queryKey: ["pagamentos", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pagamentos").select("*").eq("contrato_id", contratoId).order("mes_referencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });

  // Auto-gera meses do contrato se faltarem
  const mesesPrevistos = useMemo(() => {
    if (!contrato) return [] as string[];
    const out: string[] = [];
    const ini = new Date(contrato.data_inicio + "T00:00:00");
    const fim = new Date(contrato.data_fim + "T00:00:00");
    const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    while (cur <= fim) {
      out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-01`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [contrato]);

  async function gerarMesesFaltantes() {
    if (!contrato) return;
    const existentes = new Set(pagamentos.map((p) => p.mes_referencia.slice(0, 10)));
    const novos = mesesPrevistos
      .filter((m) => !existentes.has(m))
      .map((mes) => {
        const [y, mo] = mes.split("-").map(Number);
        const dia = Math.min(contrato.dia_vencimento || 10, 28);
        const venc = new Date(y, mo - 1, dia);
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const status = venc < hoje ? "atrasado" : "pendente";
        return {
          contrato_id: contrato.id,
          mes_referencia: mes,
          valor_previsto: contrato.valor_aluguel,
          status,
        };
      });
    if (!novos.length) { toast.info("Nenhum mês para gerar"); return; }
    const { error } = await (supabase as any).from("pagamentos").insert(novos);
    if (error) { toast.error(error.message); return; }
    toast.success(`${novos.length} mês(es) gerado(s)`);
    refetch();
  }

  const linhasOrdenadas = [...pagamentos].sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs">Contrato</Label>
          <Select value={contratoId} onValueChange={setContratoId}>
            <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
            <SelectContent>
              {contratos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.locatario_nome} — {formatBRL(c.valor_aluguel)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={gerarMesesFaltantes} disabled={!contrato}>
          Gerar meses faltantes
        </Button>
      </div>

      {!contrato ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Cadastre contratos para gerenciar pagamentos.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {contrato.locatario_nome} — {linhasOrdenadas.length} mês(es)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linhasOrdenadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento. Clique em "Gerar meses faltantes".</p>
            ) : (
              <div className="grid gap-2">
                {linhasOrdenadas.map((p) => {
                  const meta = STATUS_META[p.status];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setEditing(p); setOpen(true); }}
                      className="flex items-center justify-between gap-3 p-3 rounded border hover:border-gold/50 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium capitalize">{monthLabel(p.mes_referencia)}</div>
                          <div className="text-xs text-muted-foreground">
                            Previsto {formatBRL(p.valor_previsto)}
                            {p.valor_pago != null && ` · Pago ${formatBRL(p.valor_pago)}`}
                            {p.data_pagamento && ` em ${new Date(p.data_pagamento).toLocaleDateString("pt-BR")}`}
                          </div>
                        </div>
                      </div>
                      <Badge className={meta.color}>{meta.label}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PagamentoDialog
        open={open}
        onOpenChange={setOpen}
        pagamento={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["pagamentos", contratoId] })}
      />
    </div>
  );
}

function PagamentoDialog({ open, onOpenChange, pagamento, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; pagamento: Pagamento | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Pagamento>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !pagamento) return;
    setForm({ ...pagamento });
  }, [open, pagamento]);

  async function save() {
    if (!pagamento) return;
    setSaving(true);
    const payload: any = {
      status: form.status,
      valor_pago: form.valor_pago === undefined ? null : Number(form.valor_pago) || null,
      data_pagamento: form.data_pagamento || null,
      multa: Number(form.multa || 0),
      juros: Number(form.juros || 0),
      observacoes: form.observacoes || null,
    };
    const { error } = await (supabase as any).from("pagamentos").update(payload).eq("id", pagamento.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento atualizado");
    onOpenChange(false);
    onSaved();
  }

  if (!pagamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{monthLabel(pagamento.mes_referencia)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Pagamento["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor pago</Label>
              <Input type="number" step="0.01" value={form.valor_pago ?? ""} onChange={(e) => setForm({ ...form, valor_pago: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <Label>Data pagamento</Label>
              <Input type="date" value={form.data_pagamento ?? ""} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} />
            </div>
            <div>
              <Label>Multa</Label>
              <Input type="number" step="0.01" value={form.multa ?? 0} onChange={(e) => setForm({ ...form, multa: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Juros</Label>
              <Input type="number" step="0.01" value={form.juros ?? 0} onChange={(e) => setForm({ ...form, juros: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
