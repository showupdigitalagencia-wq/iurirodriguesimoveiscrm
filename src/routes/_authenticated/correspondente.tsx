import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listFinanciamentos,
  getFinanciamentoDetail,
  updateFinanciamentoStatus,
  deleteFinanciamento,
  type FinanciamentoRow,
  type FinanciamentoStatus,
} from "@/lib/financiamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, ExternalLink, CheckCircle2, XCircle, Clock, Loader2, Trash2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/correspondente")({
  beforeLoad: async () => {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    const isCorrespondente = roles?.some((r) => r.role === "correspondente_bancaria") ?? false;
    if (!isAdmin && !isCorrespondente) throw redirect({ to: "/dashboard" });
  },
  component: FinanciamentoAdminPage,
});

const STATUS_INFO: Record<FinanciamentoStatus, { label: string; color: string; emoji: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", emoji: "⏳" },
  em_analise: { label: "Em Análise", color: "bg-blue-500/15 text-blue-300 border-blue-500/30", emoji: "🔎" },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", emoji: "✅" },
  recusado: { label: "Recusado", color: "bg-rose-500/15 text-rose-300 border-rose-500/30", emoji: "❌" },
};

const TABS: Array<{ value: FinanciamentoStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aprovado", label: "Aprovados" },
  { value: "recusado", label: "Recusados" },
];

function FinanciamentoAdminPage() {
  const [tab, setTab] = useState<FinanciamentoStatus | "todos">("todos");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useServerFn(listFinanciamentos);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["financiamentos", tab],
    queryFn: () => list({ data: { status: tab } }),
  });

  const rows = useMemo(() => {
    const items = data?.financiamentos ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.cpf.includes(q.replace(/\D/g, "")) ||
        (r.telefone ?? "").includes(q.replace(/\D/g, "")),
    );
  }, [data, search]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financiamento</h1>
          <p className="text-sm text-muted-foreground">Pedidos de financiamento recebidos pela landing page</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar por nome, CPF ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => <FinanciamentoCard key={r.id} row={r} onOpen={() => setOpenId(r.id)} />)}
        </div>
      )}

      {openId && (
        <DetailDialog
          id={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}

function FinanciamentoCard({ row, onOpen }: { row: FinanciamentoRow; onOpen: () => void }) {
  const info = STATUS_INFO[row.status];
  return (
    <Card className="hover:border-gold/50 transition-colors cursor-pointer" onClick={onOpen}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{row.nome}</CardTitle>
          <span className={`text-xs px-2 py-0.5 rounded border ${info.color}`}>{info.emoji} {info.label}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="text-muted-foreground">📞 {row.telefone}</div>
        {row.email && <div className="text-muted-foreground truncate">✉️ {row.email}</div>}
        {row.renda_mensal != null && (
          <div>Renda: <span className="font-semibold">R$ {Number(row.renda_mensal).toLocaleString("pt-BR")}</span></div>
        )}
        {row.imovel_valor != null && (
          <div>Imóvel: <span className="font-semibold">R$ {Number(row.imovel_valor).toLocaleString("pt-BR")}</span></div>
        )}
        <div className="text-xs text-muted-foreground pt-1">
          Recebido em {new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailDialog({ id, open, onClose, onChanged }: { id: string; open: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const getDetail = useServerFn(getFinanciamentoDetail);
  const upd = useServerFn(updateFinanciamentoStatus);
  const del = useServerFn(deleteFinanciamento);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState<FinanciamentoStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["financiamento_detail", id],
    queryFn: async () => {
      const r = await getDetail({ data: { id } });
      setObservacao(r.financiamento.observacao ?? "");
      return r;
    },
  });

  async function setStatus(status: FinanciamentoStatus) {
    setSaving(status);
    try {
      await upd({ data: { id, status, observacao: observacao || undefined } });
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      qc.invalidateQueries({ queryKey: ["financiamento_detail", id] });
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await del({ data: { id } });
      toast.success("Pedido de financiamento excluído");
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      if (data?.financiamento.lead_id) {
        qc.invalidateQueries({ queryKey: ["financiamento_status_lead", data.financiamento.lead_id] });
      }
      qc.invalidateQueries({ queryKey: ["financiamento_status_lead"] });
      onChanged();
      setConfirmDelete(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.financiamento.nome ?? "Carregando…"}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : (
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF" value={data.financiamento.cpf} />
              <Field label="Telefone" value={data.financiamento.telefone} />
              <Field label="E-mail" value={data.financiamento.email ?? "—"} />
              <Field label="Estado civil" value={data.financiamento.estado_civil ?? "—"} />
              <Field label="Profissão" value={data.financiamento.profissao ?? "—"} />
              <Field
                label="Renda mensal"
                value={data.financiamento.renda_mensal != null ? `R$ ${Number(data.financiamento.renda_mensal).toLocaleString("pt-BR")}` : "—"}
              />
              <div className="col-span-2">
                <Field label="Endereço do imóvel" value={data.financiamento.imovel_endereco ?? "—"} />
              </div>
              <Field
                label="Valor do imóvel"
                value={data.financiamento.imovel_valor != null ? `R$ ${Number(data.financiamento.imovel_valor).toLocaleString("pt-BR")}` : "—"}
              />
              <Field label="Status atual" value={STATUS_INFO[data.financiamento.status].label} />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider mb-2 block">Documentos</Label>
              <div className="space-y-2">
                {([
                  ["rg", "RG"],
                  ["cpf", "CPF"],
                  ["comp_renda", "Comprovante de renda"],
                  ["comp_residencia", "Comprovante de residência"],
                  ["extrato", "Extrato bancário"],
                ] as const).map(([k, label]) => {
                  const url = data.urls[k];
                  return (
                    <div key={k} className="flex items-center justify-between border rounded p-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{label}</span>
                      </div>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold inline-flex items-center gap-1 text-xs hover:underline">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">Não enviado</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider mb-2 block">Observação / motivo</Label>
              <Textarea
                rows={3}
                placeholder="Opcional. Use para registrar o motivo da recusa ou outras observações."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={!!saving || deleting}
            className="gap-1 text-rose-500 border-rose-500/40 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setStatus("em_analise")} disabled={!!saving} className="gap-1">
              <Clock className="h-3.5 w-3.5" /> {saving === "em_analise" ? "..." : "Em Análise"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatus("aprovado")} disabled={!!saving} className="gap-1 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10">
              <CheckCircle2 className="h-3.5 w-3.5" /> {saving === "aprovado" ? "..." : "Aprovar"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatus("recusado")} disabled={!!saving} className="gap-1 text-rose-500 border-rose-500/40 hover:bg-rose-500/10">
              <XCircle className="h-3.5 w-3.5" /> {saving === "recusado" ? "..." : "Recusar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido de financiamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido de financiamento e seus documentos? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}


function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

