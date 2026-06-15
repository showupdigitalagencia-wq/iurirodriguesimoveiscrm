import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { ETAPAS, etapaNome, type LeadRow } from "@/lib/lead-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/relatorio")({
  head: () => ({ meta: [{ title: "Relatórios — Sistema NEXUS" }] }),
  component: RelatorioPage,
});

const COLORS = ["#c9a35b", "#8b6f3a", "#6c512a", "#a8893f", "#d4b06a", "#5a3f1f", "#e8c887"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Resp = { id: string; nome: string };
type Preset = "7d" | "15d" | "30d" | "custom";

function ymKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function ymLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  return `${MESES[m - 1]}/${String(y).slice(2)}`;
}

function RelatorioPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  // "all" | "compare" | <responsavel_id>
  const [respFilter, setRespFilter] = useState<string>("all");

  useEffect(() => {
    supabase.from("leads").select("*").then(({ data }) => setLeads((data as LeadRow[]) ?? []));
    supabase.from("responsaveis").select("id, nome").order("nome").then(({ data }) => setResps((data as Resp[]) ?? []));
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle()
        .then(({ data: r }) => setIsAdmin(r?.role === "admin"));
    });
  }, []);

  // Apply per-broker scoping (admin only). "compare" keeps all data; broker id narrows it.
  const scopedLeads = useMemo(() => {
    if (!isAdmin) return leads;
    if (respFilter === "all" || respFilter === "compare") return leads;
    return leads.filter((l) => l.responsavel_id === respFilter);
  }, [leads, isAdmin, respFilter]);

  // Range filter
  const range = useMemo(() => {
    const now = new Date();
    if (preset === "custom" && from && to) {
      return { start: new Date(from), end: new Date(to + "T23:59:59") };
    }
    const days = preset === "7d" ? 7 : preset === "15d" ? 15 : 30;
    const start = new Date(now); start.setDate(now.getDate() - days);
    return { start, end: now };
  }, [preset, from, to]);

  const inRange = useMemo(() => scopedLeads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  }), [scopedLeads, range]);

  const totalPeriodo = inRange.length;
  const emAtendimentoPeriodo = inRange.filter((l) => l.etapa === "em_atendimento").length;
  const reuniaoPeriodo = inRange.filter((l) => l.etapa === "reuniao_agendada").length;
  const documentosPeriodo = inRange.filter((l) => l.etapa === "documentos_enviados").length;
  const negociacaoPeriodo = inRange.filter((l) => l.etapa === "em_negociacao").length;
  const fechadosPeriodo = inRange.filter((l) => l.etapa === "fechado").length;
  const descartadosPeriodo = inRange.filter((l) => l.etapa === "descartado").length;
  const taxaPeriodo = fechadosPeriodo + descartadosPeriodo > 0
    ? Math.round((fechadosPeriodo / (fechadosPeriodo + descartadosPeriodo)) * 100) : 0;

  const porEtapaPeriodo = ETAPAS.map((e) => ({
    nome: e.nome, qtd: inRange.filter((l) => l.etapa === e.id).length,
  }));

  // Available months (descending) — from scoped leads
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const l of scopedLeads) set.add(ymKey(new Date(l.created_at)));
    return Array.from(set).sort().reverse();
  }, [scopedLeads]);

  function toggleMonth(k: string) {
    setSelectedMonths((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  }

  // Month comparison data (uses scoped leads) — agora com todas as etapas
  const compareData = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    return selectedMonths.slice().sort().map((k) => {
      const ms = scopedLeads.filter((l) => ymKey(new Date(l.created_at)) === k);
      const fechado = ms.filter((l) => l.etapa === "fechado").length;
      const perdido = ms.filter((l) => l.etapa === "descartado").length;
      return {
        mes: ymLabel(k),
        key: k,
        total: ms.length,
        em_atendimento: ms.filter((l) => l.etapa === "em_atendimento").length,
        reuniao_agendada: ms.filter((l) => l.etapa === "reuniao_agendada").length,
        solicitacao_documentos: ms.filter((l) => l.etapa === "solicitacao_documentos").length,
        documentos_enviados: ms.filter((l) => l.etapa === "documentos_enviados").length,
        em_negociacao: ms.filter((l) => l.etapa === "em_negociacao").length,
        fechados: fechado,
        descartados: perdido,
        conversao: fechado + perdido > 0 ? Math.round((fechado / (fechado + perdido)) * 100) : 0,
        leads: ms,
      };
    });
  }, [scopedLeads, selectedMonths]);

  const melhorMes = compareData.reduce((acc, cur) => !acc || cur.total > acc.total ? cur : acc, null as typeof compareData[number] | null);
  const melhorConv = compareData.reduce((acc, cur) => !acc || cur.conversao > acc.conversao ? cur : acc, null as typeof compareData[number] | null);
  const melhorDesempenho = compareData.reduce((acc, cur) => !acc || cur.fechados > acc.fechados ? cur : acc, null as typeof compareData[number] | null);

  // Per-broker per month
  const brokerCompare = useMemo(() => {
    if (compareData.length === 0) return [];
    return resps.map((r) => {
      const row: Record<string, string | number> = { nome: r.nome };
      for (const m of compareData) row[m.mes] = m.leads.filter((l) => l.responsavel_id === r.id).length;
      row.total = compareData.reduce((s, m) => s + (m.leads.filter((l) => l.responsavel_id === r.id).length), 0);
      return row;
    });
  }, [resps, compareData]);

  const melhorCorretor = useMemo(() => {
    if (brokerCompare.length === 0) return null;
    return brokerCompare.reduce((a, b) => (Number(a.total) >= Number(b.total) ? a : b));
  }, [brokerCompare]);

  // Yearly evolution (current year). Compare mode → one series per corretor; otherwise total of scoped.
  const compareBrokers = isAdmin && respFilter === "compare";
  const yearData = useMemo(() => {
    const y = new Date().getFullYear();
    return MESES.map((label, i) => {
      const monthLeads = scopedLeads.filter((l) => {
        const d = new Date(l.created_at);
        return d.getFullYear() === y && d.getMonth() === i;
      });
      const row: Record<string, string | number> = { mes: label, total: monthLeads.length };
      if (compareBrokers) {
        for (const r of resps) row[r.nome] = monthLeads.filter((l) => l.responsavel_id === r.id).length;
      }
      return row;
    });
  }, [scopedLeads, resps, compareBrokers]);

  // Per-broker funnel for compare mode
  const funnelCompare = useMemo(() => {
    if (!compareBrokers) return [];
    return ETAPAS.map((e) => {
      const row: Record<string, string | number> = { nome: e.nome };
      for (const r of resps) row[r.nome] = inRange.filter((l) => l.etapa === e.id && l.responsavel_id === r.id).length;
      return row;
    });
  }, [compareBrokers, resps, inRange]);

  const respLabel = respFilter === "all" || respFilter === "compare"
    ? null
    : resps.find((r) => r.id === respFilter)?.nome ?? null;

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1">
          {respLabel ? `Análise de ${respLabel}` : compareBrokers ? "Comparando todos os corretores" : "Análise avançada de desempenho"}
        </p>
      </header>

      {/* Filtros rápidos */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Mobile: dropdown compacto */}
        <div className="md:hidden space-y-3">
          <div>
            <Label className="text-xs">Período</Label>
            <select
              className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="15d">Últimos 15 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11" /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11" /></div>
            </div>
          )}
          {isAdmin && (
            <div>
              <Label className="text-xs">Corretor</Label>
              <select
                className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={respFilter}
                onChange={(e) => setRespFilter(e.target.value)}
              >
                <option value="all">Todos os corretores</option>
                <option value="compare">Comparar corretores</option>
                {resps.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>
        {/* Desktop: chips — inalterado */}
        <div className="hidden md:flex md:flex-wrap md:items-end md:gap-3">
          <div className="flex gap-2">
            {([
              ["7d", "Últimos 7 dias"], ["15d", "Últimos 15 dias"],
              ["30d", "Últimos 30 dias"], ["custom", "Personalizado"],
            ] as const).map(([k, l]) => (
              <Button key={k} size="sm" variant={preset === k ? "gold" : "outline"} onClick={() => setPreset(k)}>{l}</Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex gap-2 items-end">
              <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></div>
            </div>
          )}
          {isAdmin && (
            <div className="ml-auto">
              <Label className="text-xs">Corretor</Label>
              <select
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm min-w-52"
                value={respFilter}
                onChange={(e) => setRespFilter(e.target.value)}
              >
                <option value="all">Todos os corretores</option>
                <option value="compare">Comparar corretores</option>
                {resps.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Métricas do período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card label="Total de leads" value={totalPeriodo} />
        <Card label="Em atendimento" value={emAtendimentoPeriodo} />
        <Card label="Reunião agendada" value={reuniaoPeriodo} />
        <Card label="Documentos enviados" value={documentosPeriodo} />
        <Card label="Em negociação" value={negociacaoPeriodo} />
        <Card label="Fechados" value={fechadosPeriodo} />
        <Card label="Descartados" value={descartadosPeriodo} />
        <Card label="Taxa de conversão" value={`${taxaPeriodo}%`} />
      </div>

      {/* Funil do período */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h3 className="font-semibold mb-3 md:mb-4">Funil — período selecionado</h3>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="min-w-[560px] md:min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              {compareBrokers ? (
                <BarChart data={funnelCompare}>
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {resps.map((r, i) => (
                    <Bar key={r.id} dataKey={r.nome} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              ) : (
                <BarChart data={porEtapaPeriodo}>
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#c9a35b" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Evolução anual */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h3 className="font-semibold mb-3 md:mb-4">Evolução mensal — {new Date().getFullYear()}</h3>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="min-w-[640px] md:min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yearData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {compareBrokers
                  ? resps.map((r, i) => (
                      <Line key={r.id} type="monotone" dataKey={r.nome} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))
                  : <Line type="monotone" dataKey="total" stroke="#c9a35b" strokeWidth={2} dot={{ r: 4 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparação entre meses */}
      <section className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Comparar meses</h3>
          <p className="text-xs text-muted-foreground mt-1">Selecione 2 ou mais meses para comparar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMonths.map((k) => (
            <Badge key={k} variant={selectedMonths.includes(k) ? "default" : "outline"}
              className="cursor-pointer min-h-9 px-3 flex items-center" onClick={() => toggleMonth(k)}>
              {ymLabel(k)}
            </Badge>
          ))}
          {availableMonths.length === 0 && <span className="text-sm text-muted-foreground">Sem dados</span>}
        </div>

        {compareData.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 pt-2">
              <Card label="Mês com mais leads" value={melhorMes ? `${melhorMes.mes} (${melhorMes.total})` : "—"} />
              <Card label="Melhor conversão" value={melhorConv ? `${melhorConv.mes} (${melhorConv.conversao}%)` : "—"} />
              <Card label="Melhor desempenho" value={melhorDesempenho ? `${melhorDesempenho.mes} (${melhorDesempenho.fechados} fechados)` : "—"} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Comparação completa do funil por mês</h4>
              <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <div className="min-w-[720px] md:min-w-0">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={compareData}>
                      <XAxis dataKey="mes" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#c9a35b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="em_atendimento" name="Em atendimento" fill="#d4b06a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="reuniao_agendada" name="Reunião" fill="#a8893f" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="documentos_enviados" name="Documentos" fill="#8b6f3a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="em_negociacao" name="Negociação" fill="#6c512a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="fechados" name="Fechados" fill="#5a3f1f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Desempenho por corretor</h4>
              <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <div className="min-w-[560px] md:min-w-0">
                  <ResponsiveContainer width="100%" height={Math.max(220, brokerCompare.length * 50)}>
                    <BarChart data={brokerCompare} layout="vertical">
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="nome" type="category" width={90} />
                      <Tooltip />
                      <Legend />
                      {compareData.map((m, i) => (
                        <Bar key={m.key} dataKey={m.mes} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Mês</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Fechados</th>
                    <th className="text-right px-3 py-2">Conversão</th>
                    {ETAPAS.map((e) => <th key={e.id} className="text-right px-3 py-2">{etapaNome(e.id)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {compareData.map((m) => (
                    <tr key={m.key} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{m.mes}</td>
                      <td className="px-3 py-2 text-right">{m.total}</td>
                      <td className="px-3 py-2 text-right">{m.fechados}</td>
                      <td className="px-3 py-2 text-right">{m.conversao}%</td>
                      {ETAPAS.map((e) => (
                        <td key={e.id} className="px-3 py-2 text-right">
                          {m.leads.filter((l) => l.etapa === e.id).length}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-gold mt-1">{value}</div>
    </div>
  );
}
