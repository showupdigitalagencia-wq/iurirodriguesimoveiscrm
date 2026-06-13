import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canalNome, type LeadRow } from "@/lib/lead-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, BadgeCheck, XCircle, HelpCircle, Users, Car, MapPin } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";

type DadosCorretor = {
  ja_corretor?: string | null;
  creci_ativo?: string | null;
  numero_creci?: string | null;
  disponibilidade_barra?: string | null;
  disponibilidade_video?: string | null;
  possui_veiculo?: string | null;
};

type CorretorLead = LeadRow & { dados_corretor: DadosCorretor | null };
type Responsavel = { id: string; nome: string };

export const Route = createFileRoute("/_authenticated/corretores")({
  head: () => ({ meta: [{ title: "Captação de Corretores — CRM" }] }),
  component: CorretoresPage,
});

function isYes(v?: string | null) {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.startsWith("sim") || s.startsWith("yes") || s === "true";
}

function YesNo({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  if (isYes(value)) {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" />{value}</span>;
  }
  const s = value.toLowerCase();
  if (s.startsWith("não") || s.startsWith("nao") || s.startsWith("no") || s === "false") {
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />{value}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><HelpCircle className="h-3.5 w-3.5" />{value}</span>;
}

function CorretoresPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leads, setLeads] = useState<CorretorLead[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [q, setQ] = useState("");
  const [respFilter, setRespFilter] = useState<string>("todos");
  const [openLead, setOpenLead] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) { if (active) { setAuthChecked(true); navigate({ to: "/auth" }); } return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!active) return;
      const admin = data?.role === "admin";
      setIsAdmin(admin);
      setAuthChecked(true);
      if (!admin) navigate({ to: "/dashboard" });
    });
    return () => { active = false; };
  }, [navigate]);

  async function load() {
    const [{ data: ls }, { data: rs }] = await Promise.all([
      supabase.from("leads").select("*").eq("is_corretor", true).order("created_at", { ascending: false }),
      supabase.from("responsaveis").select("id, nome").order("nome"),
    ]);
    setLeads((ls as CorretorLead[]) ?? []);
    setResponsaveis((rs as Responsavel[]) ?? []);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const respMap = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r.nome])), [responsaveis]);

  const scoped = useMemo(() => {
    if (respFilter === "todos") return leads;
    return leads.filter((l) => l.responsavel_id === respFilter);
  }, [leads, respFilter]);

  const filtered = scoped.filter((l) =>
    !q || l.nome.toLowerCase().includes(q.toLowerCase()) || l.telefone.includes(q));

  const metrics = useMemo(() => {
    const total = scoped.length;
    const creciAtivo = scoped.filter((l) => isYes(l.dados_corretor?.creci_ativo)).length;
    const dispRegiao = scoped.filter((l) => isYes(l.dados_corretor?.disponibilidade_barra) || isYes(l.dados_corretor?.disponibilidade_video)).length;
    const veiculo = scoped.filter((l) => isYes(l.dados_corretor?.possui_veiculo)).length;
    return { total, creciAtivo, dispRegiao, veiculo };
  }, [scoped]);

  const countsByResp = useMemo(() => {
    const m: Record<string, number> = { todos: leads.length };
    responsaveis.forEach((r) => { m[r.id] = leads.filter((l) => l.responsavel_id === r.id).length; });
    return m;
  }, [leads, responsaveis]);

  function exportCsv() {
    const headers = [
      "Nome", "Telefone", "Email", "Executivo", "Já corretor", "CRECI ativo", "Nº CRECI",
      "Disp. Barra", "Disp. Video", "Possui veículo", "Canal", "Criado em",
    ];
    const rows = filtered.map((l) => {
      const d = l.dados_corretor ?? {};
      return [
        l.nome, l.telefone, l.email ?? "",
        l.responsavel_id ? (respMap[l.responsavel_id] ?? "") : "",
        d.ja_corretor ?? "", d.creci_ativo ?? "", d.numero_creci ?? "",
        d.disponibilidade_barra ?? "", d.disponibilidade_video ?? "", d.possui_veiculo ?? "",
        canalNome(l.canal), format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `corretores-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!authChecked || !isAdmin) {
    return <div className="p-8 text-muted-foreground">Verificando acesso...</div>;
  }

  const respLabel = respFilter === "todos" ? "Todos" : (respMap[respFilter] ?? "—");

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Captação de Corretores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtered.length} de {scoped.length} candidatos {respFilter !== "todos" && `de ${respLabel}`}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Input placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 md:w-64 h-11" />
          <Button variant="gold" onClick={exportCsv} className="h-11"><Download className="h-4 w-4" /> Exportar</Button>
        </div>
      </header>

      {/* Filtro por executivo */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={respFilter === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => setRespFilter("todos")}
          className="h-11"
        >
          Todos <span className="ml-1.5 text-xs opacity-70">({countsByResp["todos"] ?? 0})</span>
        </Button>
        {responsaveis.map((r) => (
          <Button
            key={r.id}
            variant={respFilter === r.id ? "default" : "outline"}
            size="sm"
            onClick={() => setRespFilter(r.id)}
            className="h-11"
          >
            {r.nome} <span className="ml-1.5 text-xs opacity-70">({countsByResp[r.id] ?? 0})</span>
          </Button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Total candidatos" value={metrics.total} />
        <MetricCard icon={BadgeCheck} label="CRECI ativo" value={metrics.creciAtivo} />
        <MetricCard icon={MapPin} label="Disp. na região" value={metrics.dispRegiao} />
        <MetricCard icon={Car} label="Possui veículo" value={metrics.veiculo} />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((l) => {
          const d = l.dados_corretor ?? {};
          return (
            <Card key={l.id} className="cursor-pointer active:bg-muted/40" onClick={() => setOpenLead(l.id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">{l.telefone}</div>
                    {l.email && <div className="text-xs text-muted-foreground truncate">{l.email}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{l.responsavel_id ? respMap[l.responsavel_id] : "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-border">
                  <div className="text-xs"><span className="text-muted-foreground">CRECI: </span><YesNo value={d.creci_ativo} /></div>
                  <div className="text-xs"><span className="text-muted-foreground">Nº: </span>{d.numero_creci ?? "—"}</div>
                  <div className="text-xs"><span className="text-muted-foreground">Barra: </span><YesNo value={d.disponibilidade_barra} /></div>
                  <div className="text-xs"><span className="text-muted-foreground">Video: </span><YesNo value={d.disponibilidade_video} /></div>
                  <div className="text-xs col-span-2"><span className="text-muted-foreground">Veículo: </span><YesNo value={d.possui_veiculo} /></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">Nenhuma captação encontrada.</div>
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Executivo</TableHead>
              <TableHead>Já corretor</TableHead>
              <TableHead>CRECI</TableHead>
              <TableHead>Nº CRECI</TableHead>
              <TableHead>Barra</TableHead>
              <TableHead>Video</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => {
              const d = l.dados_corretor ?? {};
              return (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenLead(l.id)}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-sm">
                    <div>{l.telefone}</div>
                    {l.email && <div className="text-muted-foreground text-xs">{l.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{l.responsavel_id ? respMap[l.responsavel_id] : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><YesNo value={d.ja_corretor} /></TableCell>
                  <TableCell><YesNo value={d.creci_ativo} /></TableCell>
                  <TableCell className="text-sm">{d.numero_creci ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><YesNo value={d.disponibilidade_barra} /></TableCell>
                  <TableCell><YesNo value={d.disponibilidade_video} /></TableCell>
                  <TableCell><YesNo value={d.possui_veiculo} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                Nenhuma captação encontrada.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LeadDetailSheet leadId={openLead} onClose={() => setOpenLead(null)} onUpdated={load} backLabel="Voltar aos Corretores" />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
