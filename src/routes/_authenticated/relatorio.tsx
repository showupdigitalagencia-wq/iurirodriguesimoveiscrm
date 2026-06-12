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
  head: () => ({ meta: [{ title: "Relatórios — CRM" }] }),
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
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("leads").select("*").then(({ data }) => setLeads((data as LeadRow[]) ?? []));
    supabase.from("responsaveis").select("id, nome").then(({ data }) => setResps((data as Resp[]) ?? []));
  }, []);

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

  const inRange = useMemo(() => leads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  }), [leads, range]);

  const totalPeriodo = inRange.length;
  const fechadosPeriodo = inRange.filter((l) => l.etapa === "fechado").length;
  const descartadosPeriodo = inRange.filter((l) => l.etapa === "descartado").length;
  const taxaPeriodo = fechadosPeriodo + descartadosPeriodo > 0
    ? Math.round((fechadosPeriodo / (fechadosPeriodo + descartadosPeriodo)) * 100) : 0;

  const porEtapaPeriodo = ETAPAS.map((e) => ({
    nome: e.nome, qtd: inRange.filter((l) => l.etapa === e.id).length,
  }));

  // Available months (descending)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) set.add(ymKey(new Date(l.created_at)));
    return Array.from(set).sort().reverse();
  }, [leads]);

  function toggleMonth(k: string) {
    setSelectedMonths((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  }

  // Month comparison data
  const compareData = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    return selectedMonths.slice().sort().map((k) => {
      const ms = leads.filter((l) => ymKey(new Date(l.created_at)) === k);
      const fechado = ms.filter((l) => l.etapa === "fechado").length;
      const perdido = ms.filter((l) => l.etapa === "descartado").length;
      return {
        mes: ymLabel(k),
        key: k,
        total: ms.length,
        fechados: fechado,
        conversao: fechado + perdido > 0 ? Math.round((fechado / (fechado + perdido)) * 100) : 0,
        leads: ms,
      };
    });
  }, [leads, selectedMonths]);

  const melhorMes = compareData.reduce((acc, cur) => !acc || cur.total > acc.total ? cur : acc, null as typeof compareData[number] | null);
  const melhorConv = compareData.reduce((acc, cur) => !acc || cur.conversao > acc.conversao ? cur : acc, null as typeof compareData[number] | null);

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

  // Yearly evolution (current year)
  const yearData = useMemo(() => {
    const y = new Date().getFullYear();
    return MESES.map((label, i) => ({
      mes: label,
      total: leads.filter((l) => {
        const d = new Date(l.created_at);
        return d.getFullYear() === y && d.getMonth() === i;
      }).length,
    }));
  }, [leads]);

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise avançada de desempenho</p>
      </header>

      {/* Filtros rápidos */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
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
        </div>
      </section>

      {/* Métricas do período */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card label="Total de leads" value={totalPeriodo} />
        <Card label="Fechados" value={fechadosPeriodo} />
        <Card label="Descartados" value={descartadosPeriodo} />
        <Card label="Taxa de conversão" value={`${taxaPeriodo}%`} />
      </div>

      {/* Funil do período */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Funil — período selecionado</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porEtapaPeriodo}>
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="qtd" fill="#c9a35b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Evolução anual */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Evolução mensal — {new Date().getFullYear()}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={yearData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="mes" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#c9a35b" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Comparação entre meses */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Comparar meses</h3>
          <p className="text-xs text-muted-foreground mt-1">Selecione 2 ou mais meses para comparar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMonths.map((k) => (
            <Badge key={k} variant={selectedMonths.includes(k) ? "default" : "outline"}
              className="cursor-pointer" onClick={() => toggleMonth(k)}>
              {ymLabel(k)}
            </Badge>
          ))}
          {availableMonths.length === 0 && <span className="text-sm text-muted-foreground">Sem dados</span>}
        </div>

        {compareData.length > 0 && (
          <>
            <div className="grid md:grid-cols-3 gap-4 pt-2">
              <Card label="Mês com mais leads" value={melhorMes ? `${melhorMes.mes} (${melhorMes.total})` : "—"} />
              <Card label="Melhor conversão" value={melhorConv ? `${melhorConv.mes} (${melhorConv.conversao}%)` : "—"} />
              <Card label="Melhor corretor" value={melhorCorretor ? `${melhorCorretor.nome} (${melhorCorretor.total})` : "—"} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Total de leads por mês</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={compareData}>
                  <XAxis dataKey="mes" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="#c9a35b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fechados" name="Fechados" fill="#6c512a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Desempenho por corretor</h4>
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
