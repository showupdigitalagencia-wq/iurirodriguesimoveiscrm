import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

type AuditRow = {
  id: string;
  user_id: string | null;
  user_nome: string | null;
  acao: string;
  tabela: string | null;
  registro_id: string | null;
  antes: unknown;
  depois: unknown;
  contexto: unknown;
  criado_em: string;
};

const ACOES = [
  { value: "todas", label: "Todas as ações" },
  { value: "financiamento_status_change", label: "Financiamento — status" },
  { value: "financiamento_documentos_view", label: "Financiamento — ver documentos" },
  { value: "financiamento_delete", label: "Financiamento — exclusão" },
  { value: "role_grant", label: "Papel concedido" },
  { value: "role_revoke", label: "Papel removido" },
  { value: "role_change", label: "Papel alterado" },
  { value: "delete", label: "Exclusão (qualquer tabela)" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  beforeLoad: async () => {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    if (!isAdmin) throw redirect({ to: "/admin" });
  },
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [acao, setAcao] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from("audit_log" as never).select("*").order("criado_em", { ascending: false }).limit(500);
    if (acao !== "todas") q = q.eq("acao", acao);
    const { data, error } = await q;
    if (!error) setRows((data ?? []) as unknown as AuditRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [acao]);

  const filtered = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.user_nome, r.acao, r.tabela, r.registro_id].some((v) =>
        v ? String(v).toLowerCase().includes(t) : false
      )
    );
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-gold" /> Log de Auditoria
          </h2>
          <p className="text-xs text-muted-foreground">
            Registro imutável das ações sensíveis do sistema. Apenas admins têm acesso.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={acao} onValueChange={setAcao}>
            <SelectTrigger className="w-full md:w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por usuário, tabela ou registro…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full md:w-[320px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            {rows.length === 500 && <span className="text-muted-foreground ml-2">(últimos 500)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <div key={r.id} className="px-4 py-3 text-sm">
                    <button
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{r.acao}</Badge>
                          {r.tabela && <Badge variant="secondary">{r.tabela}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.criado_em).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.user_nome ?? "Sistema"}</span>
                          {r.registro_id && <> · registro <code className="font-mono">{r.registro_id.slice(0, 8)}…</code></>}
                        </div>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-3 ml-7 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <JsonBlock title="Antes" value={r.antes} />
                        <JsonBlock title="Depois" value={r.depois} />
                        <JsonBlock title="Contexto" value={r.contexto} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div className="rounded border bg-muted/30 p-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
        <div className="text-xs text-muted-foreground">—</div>
      </div>
    );
  }
  return (
    <div className="rounded border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <pre className="text-[11px] overflow-auto max-h-40 font-mono">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
