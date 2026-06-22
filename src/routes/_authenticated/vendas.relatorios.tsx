import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Trophy, Timer, Target,
  Handshake, KeyRound, Crown, User, UsersRound, CalendarCheck,
  BarChart3, Clock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VendasFunilPanel } from "@/components/vendas-funil-panel";
import { VendasTempoRespostaPanel } from "@/components/vendas-tempo-resposta-panel";

export const Route = createFileRoute("/_authenticated/vendas/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Vendas" }] }),
  component: VendasRelatoriosPage,
});

const COLORS = ["#d4af37", "#b8860b", "#8b6f3a", "#c9a35b", "#e8c887", "#a8893f", "#6c512a"];
const SALES_COLORS = ["#d4af37", "#1f2937"];

type Preset = "7d" | "15d" | "30d" | "60d" | "90d" | "custom";
type Scope = "me" | "team" | "user" | "all";

type CorretorRow = { id: string; nome: string; recebidos: number; atendidos: number; vendas: number; locacoes: number; fechados: number; fechados_sem_comissao?: number; receita: number; conversao: number };
type EquipeRow = { id: string; nome: string; recebidos: number; atendidos: number; vendas: number; locacoes: number; fechados: number; fechados_sem_comissao?: number; receita: number; conversao: number };
type PlantaoRow = { id: string; nome: string; recebidos: number; atendidos: number; redirecionados: number; reatribuicoes: number };
type OrigemRow = { canal: string; qtd: number };
type EvolRow = { dia: string; leads: number; fechados: number };
type CompBlock = { vendas: number; locacoes: number; receita: number; total_leads: number; atendidos: number; fechados_sem_comissao?: number };

type VisitasBlock = {
  total: number; realizadas: number; nao_compareceu: number;
  pendentes_confirmacao: number; futuras: number;
  taxa_comparecimento: number | null;
};

type Relatorio = {
  periodo: { from: string; to: string; prev_from: string; prev_to: string };
  escopo: { is_admin: boolean; is_exec: boolean; scope: Scope; target_id: string | null; exec_id: string | null; usuarios: number };
  tempo_resposta_seg: number | null;
  evolucao: EvolRow[];
  corretores: CorretorRow[];
  equipes: EquipeRow[];
  plantao: PlantaoRow[];
  origem: OrigemRow[];
  visitas?: VisitasBlock | null;
  comparacao: { atual: CompBlock; anterior: CompBlock };
};

type Escopos = {
  is_admin: boolean;
  is_exec: boolean;
  exec_id: string | null;
  corretores: { id: string; nome: string; equipe_id: string | null }[];
  equipes: { id: string; nome: string }[];
};

const ORIGEM_LABEL: Record<string, string> = {
  facebook: "Facebook", zap_imoveis: "ZAP Imóveis", olx: "OLX", site: "Site",
  whatsapp_empresa: "WhatsApp", manual: "Manual", outro: "Outro",
};

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
}

function delta(atual: number, anterior: number): { txt: string; up: boolean | null; pct: number } {
  if (anterior === 0) {
    if (atual === 0) return { txt: "—", up: null, pct: 0 };
    return { txt: "+100%", up: true, pct: 100 };
  }
  const pct = ((atual - anterior) / anterior) * 100;
  return { txt: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: pct === 0 ? null : pct > 0, pct };
}

function fmtTempo(seg: number | null): string {
  if (!seg || seg <= 0) return "—";
  if (seg < 60) return `${Math.round(seg)}s`;
  if (seg < 3600) return `${Math.round(seg / 60)} min`;
  if (seg < 86400) return `${(seg / 3600).toFixed(1)} h`;
  return `${(seg / 86400).toFixed(1)} d`;
}

function fmtDia(s: string) {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}

function VendasRelatoriosPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("me");
  const [targetId, setTargetId] = useState<string>("");
  const [data, setData] = useState<Relatorio | null>(null);
  const [escopos, setEscopos] = useState<Escopos | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load allowed scopes once
  useEffect(() => {
    (async () => {
      const { data: e, error } = await supabase.rpc("get_vendas_relatorio_escopos");
      if (error) { setErr(error.message); return; }
      const esc = e as unknown as Escopos;
      setEscopos(esc);
      // Default scope: corretor → me; executivo → me; admin → all
      if (esc.is_admin) setScope("all");
      else setScope("me");
    })();
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "custom" && from && to) {
      return { from: new Date(from).toISOString(), to: new Date(to + "T23:59:59").toISOString() };
    }
    const days = preset === "7d" ? 7 : preset === "15d" ? 15 : preset === "30d" ? 30 : preset === "60d" ? 60 : 90;
    const start = new Date(now); start.setDate(now.getDate() - days);
    return { from: start.toISOString(), to: now.toISOString() };
  }, [preset, from, to]);

  useEffect(() => {
    if (!escopos) return;
    let alive = true;
    setLoading(true); setErr(null);
    (async () => {
      const { data: d, error } = await supabase.rpc("get_vendas_relatorio_v2", {
        _from: range.from, _to: range.to,
        _scope: scope, _target_id: targetId || undefined,
      });
      if (!alive) return;
      if (error) { setErr(error.message); setData(null); }
      else setData(d as unknown as Relatorio);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [range.from, range.to, scope, targetId, escopos]);

  const origemChart = useMemo(() => (data?.origem ?? []).map((o) => ({
    canal: ORIGEM_LABEL[o.canal] ?? o.canal, qtd: Number(o.qtd) || 0,
  })), [data]);

  const evolChart = useMemo(() => (data?.evolucao ?? []).map((e) => ({
    dia: fmtDia(e.dia), Leads: Number(e.leads), Fechados: Number(e.fechados),
  })), [data]);

  const vendasLocacoesChart = useMemo(() => {
    if (!data) return [];
    const v = Number(data.comparacao.atual.vendas) || 0;
    const l = Number(data.comparacao.atual.locacoes) || 0;
    if (v + l === 0) return [];
    return [{ name: "Vendas", value: v }, { name: "Locações", value: l }];
  }, [data]);

  const conv = useMemo(() => {
    if (!data) return 0;
    const total = data.comparacao.atual.total_leads || 0;
    const fech = (data.comparacao.atual.vendas || 0) + (data.comparacao.atual.locacoes || 0);
    return total > 0 ? Math.round((fech / total) * 1000) / 10 : 0;
  }, [data]);
  const convPrev = useMemo(() => {
    if (!data) return 0;
    const total = data.comparacao.anterior.total_leads || 0;
    const fech = (data.comparacao.anterior.vendas || 0) + (data.comparacao.anterior.locacoes || 0);
    return total > 0 ? Math.round((fech / total) * 1000) / 10 : 0;
  }, [data]);

  const dVendas = data ? delta(data.comparacao.atual.vendas, data.comparacao.anterior.vendas) : null;
  const dLoc = data ? delta(data.comparacao.atual.locacoes, data.comparacao.anterior.locacoes) : null;
  const dRec = data ? delta(Number(data.comparacao.atual.receita), Number(data.comparacao.anterior.receita)) : null;
  const dLeads = data ? delta(data.comparacao.atual.total_leads, data.comparacao.anterior.total_leads) : null;
  const dConv = delta(conv, convPrev);

  const showScopeSelector = escopos && (escopos.is_admin || escopos.is_exec);
  const showRanking = data && (scope === "team" || scope === "all") && data.corretores.length > 1;
  const corretoresVisiveis = escopos?.corretores ?? [];

  return (
    <div className="space-y-6">
      {/* Header premium */}
      <header className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-background to-background p-5 md:p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3 flex-wrap relative">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-gold" />
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">Relatórios de Vendas</h2>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm">
              {escopos?.is_admin ? "Visão executiva — toda a operação" :
               escopos?.is_exec ? "Sua equipe e seu desempenho" :
               "Seu desempenho pessoal"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {escopos?.is_admin && <Badge variant="outline" className="border-gold/40 text-gold"><Crown className="h-3 w-3 mr-1" /> Admin</Badge>}
            {escopos?.is_exec && <Badge variant="outline" className="border-gold/40 text-gold"><UsersRound className="h-3 w-3 mr-1" /> Executivo</Badge>}
            {!escopos?.is_admin && !escopos?.is_exec && <Badge variant="outline"><User className="h-3 w-3 mr-1" /> Corretor</Badge>}
          </div>
        </div>
      </header>

      {/* Controles: escopo + período */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        {showScopeSelector && (
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
            <Label className="text-xs font-semibold text-muted-foreground mr-1">Visão:</Label>
            <Button size="sm" variant={scope === "me" ? "gold" : "outline"} onClick={() => { setScope("me"); setTargetId(""); }}>
              <User className="h-3.5 w-3.5 mr-1.5" /> Meu relatório
            </Button>
            {escopos?.is_exec && !escopos.is_admin && (
              <Button size="sm" variant={scope === "team" ? "gold" : "outline"} onClick={() => { setScope("team"); setTargetId(""); }}>
                <UsersRound className="h-3.5 w-3.5 mr-1.5" /> Minha equipe
              </Button>
            )}
            {escopos?.is_admin && (
              <Button size="sm" variant={scope === "all" ? "gold" : "outline"} onClick={() => { setScope("all"); setTargetId(""); }}>
                <Crown className="h-3.5 w-3.5 mr-1.5" /> Visão geral
              </Button>
            )}
            {escopos?.is_admin && (escopos?.equipes?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Equipe:</Label>
                <Select value={scope === "team" ? (targetId || "") : ""} onValueChange={(v) => { setScope("team"); setTargetId(v); }}>
                  <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
                  <SelectContent>
                    {escopos.equipes.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {corretoresVisiveis.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Corretor:</Label>
                <Select value={scope === "user" ? (targetId || "") : ""} onValueChange={(v) => { setScope("user"); setTargetId(v); }}>
                  <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Selecionar corretor..." /></SelectTrigger>
                  <SelectContent>
                    {corretoresVisiveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome || "(sem nome)"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs font-semibold text-muted-foreground mr-1">Período:</Label>
          {(["7d","15d","30d","60d","90d","custom"] as const).map((k) => (
            <Button key={k} size="sm" variant={preset === k ? "gold" : "outline"} onClick={() => setPreset(k)}>
              {k === "custom" ? "Personalizado" : `${k.replace("d","")} dias`}
            </Button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2 items-end flex-wrap">
            <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></div>
          </div>
        )}
      </section>

      {err && <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-md p-3 text-sm">{err}</div>}
      {loading && <div className="text-sm text-muted-foreground animate-pulse">Carregando relatório...</div>}

      {data && !loading && (
        <>
          {/* KPI cards — métricas principais */}
          <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="Leads recebidos" value={data.comparacao.atual.total_leads} d={dLeads!} accent="sky" />
            <KpiCard icon={Target} label="Taxa de conversão" value={`${conv}%`} d={dConv} accent="emerald" />
            <KpiCard icon={Handshake} label="Vendas" value={data.comparacao.atual.vendas} d={dVendas!} accent="gold" />
            <KpiCard icon={KeyRound} label="Locações" value={data.comparacao.atual.locacoes} d={dLoc!} accent="violet" />
            <KpiCard icon={Timer} label="Tempo médio resposta" value={fmtTempo(data.tempo_resposta_seg)} d={null} accent="rose" />
            <KpiCard
              icon={CalendarCheck}
              label="Taxa de comparecimento"
              value={data.visitas?.taxa_comparecimento != null ? `${data.visitas.taxa_comparecimento}%` : "—"}
              d={null}
              accent="emerald"
              hint={data.visitas
                ? `${data.visitas.realizadas} realizadas · ${data.visitas.nao_compareceu} não compareceu${data.visitas.pendentes_confirmacao ? ` · ${data.visitas.pendentes_confirmacao} a confirmar` : ""}`
                : undefined}
            />
          </section>

          {/* Receita destacada */}
          <section className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/5 via-card to-card p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Receita gerada no período (comissão)</div>
              <div className="text-3xl md:text-4xl font-bold mt-1 text-gold">{brl(Number(data.comparacao.atual.receita))}</div>
              {Number(data.comparacao.atual.fechados_sem_comissao || 0) > 0 && (
                <div className="text-[11px] mt-1 text-amber-600 dark:text-amber-400">
                  ⚠ {data.comparacao.atual.fechados_sem_comissao} fechado(s) sem comissão calculada — preencha o imóvel no lead.
                </div>
              )}
            </div>
            {dRec && (
              <div className={`flex items-center gap-2 text-sm font-medium ${dRec.up === null ? "text-muted-foreground" : dRec.up ? "text-emerald-500" : "text-red-500"}`}>
                {dRec.up === true ? <TrendingUp className="h-5 w-5" /> : dRec.up === false ? <TrendingDown className="h-5 w-5" /> : null}
                <div>
                  <div>{dRec.txt}</div>
                  <div className="text-xs text-muted-foreground">vs período anterior ({brl(Number(data.comparacao.anterior.receita))})</div>
                </div>
              </div>
            )}
          </section>

          {/* Gráficos: evolução + pizza */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 md:p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gold" /> Evolução no período</h3>
              <p className="text-xs text-muted-foreground mb-3">Leads recebidos × fechamentos por dia</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={evolChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="Leads" stroke="#d4af37" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Fechados" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 md:p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Handshake className="h-4 w-4 text-gold" /> Vendas vs Locações</h3>
              <p className="text-xs text-muted-foreground mb-3">Distribuição de fechamentos</p>
              {vendasLocacoesChart.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sem fechamentos no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={vendasLocacoesChart} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={3} label>
                      {vendasLocacoesChart.map((_, i) => <Cell key={i} fill={SALES_COLORS[i % SALES_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Ranking quando visão de equipe/geral */}
          {showRanking && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-gold" /> Ranking de corretores</h3>
              <div className="space-y-2">
                {data.corretores.slice(0, 10).map((c, i) => {
                  const medal = i === 0 ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950" :
                                i === 1 ? "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900" :
                                i === 2 ? "bg-gradient-to-r from-orange-400 to-orange-600 text-white" :
                                "bg-muted text-muted-foreground";
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/40 transition-colors">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${medal}`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.nome || "(sem nome)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.recebidos} leads · {c.vendas}v / {c.locacoes}l · conv {c.conversao}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gold">{brl(Number(c.receita))}</div>
                        <div className="text-[10px] text-muted-foreground">receita</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tabela detalhada de corretores */}
          <section className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="font-semibold mb-4">Desempenho por corretor</h3>
            {data.corretores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-3 py-2">Corretor</th>
                      <th className="px-3 py-2 text-right">Recebidos</th>
                      <th className="px-3 py-2 text-right">Atendidos</th>
                      <th className="px-3 py-2 text-right">Vendas</th>
                      <th className="px-3 py-2 text-right">Locações</th>
                      <th className="px-3 py-2 text-right">Conversão</th>
                      <th className="px-3 py-2 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.corretores.map((c) => (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{c.nome || "—"}</td>
                        <td className="px-3 py-2 text-right">{c.recebidos}</td>
                        <td className="px-3 py-2 text-right">{c.atendidos}</td>
                        <td className="px-3 py-2 text-right">{c.vendas}</td>
                        <td className="px-3 py-2 text-right">{c.locacoes}</td>
                        <td className="px-3 py-2 text-right">{c.conversao}%</td>
                        <td className="px-3 py-2 text-right font-semibold text-gold">{brl(Number(c.receita))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Equipes (admin) */}
          {data.escopo.is_admin && data.equipes.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="font-semibold mb-4">Desempenho por equipe</h3>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-3 py-2">Equipe</th>
                      <th className="px-3 py-2 text-right">Recebidos</th>
                      <th className="px-3 py-2 text-right">Vendas</th>
                      <th className="px-3 py-2 text-right">Locações</th>
                      <th className="px-3 py-2 text-right">Conversão</th>
                      <th className="px-3 py-2 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.equipes.map((e) => (
                      <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{e.nome}</td>
                        <td className="px-3 py-2 text-right">{e.recebidos}</td>
                        <td className="px-3 py-2 text-right">{e.vendas}</td>
                        <td className="px-3 py-2 text-right">{e.locacoes}</td>
                        <td className="px-3 py-2 text-right">{e.conversao}%</td>
                        <td className="px-3 py-2 text-right font-semibold text-gold">{brl(Number(e.receita))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Plantão */}
          {data.plantao.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="font-semibold mb-4">Relatório do Plantão</h3>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-3 py-2">Plantonista</th>
                      <th className="px-3 py-2 text-right">Leads recebidos</th>
                      <th className="px-3 py-2 text-right">Atendidos</th>
                      <th className="px-3 py-2 text-right">Redir. demora</th>
                      <th className="px-3 py-2 text-right">Reatribuições</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.plantao.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{p.nome || "—"}</td>
                        <td className="px-3 py-2 text-right">{p.recebidos}</td>
                        <td className="px-3 py-2 text-right">{p.atendidos}</td>
                        <td className="px-3 py-2 text-right">{p.redirecionados}</td>
                        <td className="px-3 py-2 text-right">{p.reatribuicoes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Origem dos leads */}
          {origemChart.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="font-semibold mb-4">Origem dos leads</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={origemChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                    {origemChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const ACCENT: Record<string, string> = {
  sky: "from-sky-500/10 to-transparent border-sky-500/20 text-sky-500",
  emerald: "from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-500",
  gold: "from-gold/10 to-transparent border-gold/30 text-gold",
  violet: "from-violet-500/10 to-transparent border-violet-500/20 text-violet-500",
  rose: "from-rose-500/10 to-transparent border-rose-500/20 text-rose-500",
};

function KpiCard({ icon: Icon, label, value, d, accent, hint }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string;
  d: { txt: string; up: boolean | null } | null;
  accent: keyof typeof ACCENT;
  hint?: string;
}) {
  const cls = ACCENT[accent];
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${cls} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-5 w-5 ${cls.split(" ").find((c) => c.startsWith("text-")) ?? ""}`} />
        {d && d.up !== null && (
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${d.up ? "text-emerald-500" : "text-red-500"}`}>
            {d.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {d.txt}
          </span>
        )}
      </div>
      <div className="text-2xl md:text-3xl font-bold leading-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{hint}</div>}
    </div>
  );
}
