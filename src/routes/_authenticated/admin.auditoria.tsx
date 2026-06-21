import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Clock } from "lucide-react";

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

type LeadSemResposta = {
  id: string;
  tabela: string;
  nome: string;
  telefone: string;
  origem: string | null;
  regiao: string | null;
  created_at: string;
  responsavel_nome: string | null;
  atribuicao_status: string | null;
  segundos_decorridos: number;
};

const ACOES = [
  { value: "todas", label: "Todas as ações" },
  { value: "leads_sem_resposta", label: "🚨 Leads sem resposta" },
  { value: "lead_created", label: "Lead criado" },
  { value: "lead_first_response", label: "Lead — primeiro contato" },
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

function formatDuration(seg: number): string {
  if (seg < 60) return `${Math.round(seg)}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const mm = min % 60;
  if (h < 24) return `${h}h ${mm}min`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return `${d}d ${hh}h`;
}

function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [leadsSR, setLeadsSR] = useState<LeadSemResposta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [acao, setAcao] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (acao === "leads_sem_resposta") {
      const { data, error } = await supabase.rpc("get_leads_sem_resposta" as never);
      if (!error && data) {
        const d = data as unknown as { leads: LeadSemResposta[] };
        setLeadsSR(d.leads ?? []);
      } else {
        setLeadsSR([]);
      }
    } else {
      setLeadsSR(null);
      let q = supabase.from("audit_log" as never).select("*").order("criado_em", { ascending: false }).limit(500);
      if (acao !== "todas") q = q.eq("acao", acao);
      const { data, error } = await q;
      if (!error) setRows((data ?? []) as unknown as AuditRow[]);
    }
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

  const filteredSR = useMemo(() => {
    if (!leadsSR) return [];
    const t = busca.trim().toLowerCase();
    if (!t) return leadsSR;
    return leadsSR.filter((l) =>
      [l.nome, l.telefone, l.origem, l.regiao, l.responsavel_nome].some((v) =>
        v ? String(v).toLowerCase().includes(t) : false
      )
    );
  }, [leadsSR, busca]);

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
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={acao} onValueChange={setAcao}>
            <SelectTrigger className="w-full md:w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder={leadsSR ? "Buscar por lead, telefone, responsável…" : "Buscar por usuário, tabela ou registro…"}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full md:w-[320px]"
          />
        </CardContent>
      </Card>

      {leadsSR ? (
        <LeadsSemRespostaCard leads={filteredSR} total={leadsSR.length} />
      ) : (
        <LogCard rows={filtered} expanded={expanded} setExpanded={setExpanded} />
      )}
    </div>
  );
}

function LeadsSemRespostaCard({ leads, total }: { leads: LeadSemResposta[]; total: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {leads.length} de {total} leads sem primeiro contato registrado
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {leads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum lead pendente — todos receberam primeiro contato. 🎉
          </p>
        ) : (
          <div className="divide-y">
            {leads.map((l) => {
              const horas = l.segundos_decorridos / 3600;
              const cor = horas >= 24 ? "text-red-600" : horas >= 4 ? "text-amber-600" : "text-muted-foreground";
              return (
                <div key={`${l.tabela}-${l.id}`} className="px-4 py-3 text-sm flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="font-medium">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.telefone} · {(l.origem ?? "—").replace(/_/g, " ")}
                      {l.regiao && <> · {l.regiao.replace(/_/g, " ")}</>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Responsável: <span className="text-foreground">{l.responsavel_nome ?? "Não atribuído"}</span>
                      {l.atribuicao_status && <> · <Badge variant="outline" className="ml-1">{l.atribuicao_status}</Badge></>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-1 font-semibold ${cor}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(l.segundos_decorridos)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      desde {new Date(l.created_at).toLocaleString("pt-BR")}
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{l.tabela}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogCard({
  rows, expanded, setExpanded,
}: { rows: AuditRow[]; expanded: string | null; setExpanded: (v: string | null) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const isOpen = expanded === r.id;
              const tempo = extractTempoResposta(r);
              return (
                <div key={r.id} className="px-4 py-3 text-sm">
                  <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full flex items-start gap-3 text-left">
                    {isOpen ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{r.acao}</Badge>
                        {r.tabela && <Badge variant="secondary">{r.tabela}</Badge>}
                        {tempo !== null && (
                          <Badge variant="default" className="bg-emerald-600/10 text-emerald-700 border-emerald-600/30">
                            <Clock className="h-3 w-3 mr-1" />{formatDuration(tempo)}
                          </Badge>
                        )}
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
  );
}

function extractTempoResposta(r: AuditRow): number | null {
  if (r.acao !== "lead_first_response") return null;
  const d = r.depois as { tempo_resposta_seg?: number } | null;
  if (d && typeof d.tempo_resposta_seg === "number") return d.tempo_resposta_seg;
  return null;
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
