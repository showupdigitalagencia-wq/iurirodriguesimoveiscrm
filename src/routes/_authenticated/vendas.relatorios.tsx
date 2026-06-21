import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/vendas/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Vendas" }] }),
  component: VendasRelatoriosPage,
});

const COLORS = ["#c9a35b", "#8b6f3a", "#6c512a", "#a8893f", "#d4b06a", "#5a3f1f", "#e8c887"];
type Preset = "7d" | "15d" | "30d" | "60d" | "90d" | "custom";

type CorretorRow = { id: string; nome: string; recebidos: number; atendidos: number; vendas: number; locacoes: number; fechados: number; receita: number; conversao: number };
type EquipeRow = { id: string; nome: string; recebidos: number; atendidos: number; vendas: number; locacoes: number; fechados: number; receita: number; conversao: number };
type PlantaoRow = { id: string; nome: string; recebidos: number; atendidos: number; redirecionados: number; reatribuicoes: number };
type OrigemRow = { canal: string; qtd: number };
type CompBlock = { vendas: number; locacoes: number; receita: number; total_leads: number };

type Relatorio = {
  periodo: { from: string; to: string; prev_from: string; prev_to: string };
  escopo: { is_admin: boolean; is_exec: boolean; usuarios: number };
  corretores: CorretorRow[];
  equipes: EquipeRow[];
  plantao: PlantaoRow[];
  origem: OrigemRow[];
  comparacao: { atual: CompBlock; anterior: CompBlock };
};

const ORIGEM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  zap_imoveis: "ZAP Imóveis",
  olx: "OLX",
  site: "Site",
  whatsapp_empresa: "WhatsApp",
  manual: "Manual",
  outro: "Outro",
};

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
}

function delta(atual: number, anterior: number): { txt: string; up: boolean | null } {
  if (anterior === 0) return { txt: atual === 0 ? "—" : "+∞", up: atual > 0 ? true : null };
  const pct = ((atual - anterior) / anterior) * 100;
  return { txt: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: pct === 0 ? null : pct > 0 };
}

function VendasRelatoriosPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    let alive = true;
    setLoading(true); setErr(null);
    (async () => {
      const { data: d, error } = await supabase.rpc("get_vendas_relatorio", { _from: range.from, _to: range.to });
      if (!alive) return;
      if (error) { setErr(error.message); setData(null); }
      else setData(d as unknown as Relatorio);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [range.from, range.to]);

  const origemChart = useMemo(() => (data?.origem ?? []).map((o) => ({
    canal: ORIGEM_LABEL[o.canal] ?? o.canal, qtd: Number(o.qtd) || 0,
  })), [data]);

  const dVendas = data ? delta(data.comparacao.atual.vendas, data.comparacao.anterior.vendas) : null;
  const dLoc = data ? delta(data.comparacao.atual.locacoes, data.comparacao.anterior.locacoes) : null;
  const dRec = data ? delta(Number(data.comparacao.atual.receita), Number(data.comparacao.anterior.receita)) : null;
  const dLeads = data ? delta(data.comparacao.atual.total_leads, data.comparacao.anterior.total_leads) : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <header>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Relatórios de Vendas</h2>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">
          {data?.escopo.is_admin ? "Visão geral da operação" : data?.escopo.is_exec ? "Sua equipe" : "Seu desempenho"}
        </p>
      </header>

      {/* Filtros */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
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
      {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}

      {data && (
        <>
          {/* Comparação de período */}
          <section className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="font-semibold mb-3 md:mb-4">Comparação com período anterior</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DeltaCard label="Total de leads" atual={data.comparacao.atual.total_leads} d={dLeads!} />
              <DeltaCard label="Vendas fechadas" atual={data.comparacao.atual.vendas} d={dVendas!} />
              <DeltaCard label="Locações fechadas" atual={data.comparacao.atual.locacoes} d={dLoc!} />
              <DeltaCard label="Receita gerada" atual={brl(Number(data.comparacao.atual.receita))} d={dRec!} />
            </div>
          </section>

          {/* Desempenho por corretor */}
          <section className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="font-semibold mb-3 md:mb-4">Desempenho por corretor</h3>
            {data.corretores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
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
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{c.nome || "—"}</td>
                        <td className="px-3 py-2 text-right">{c.recebidos}</td>
                        <td className="px-3 py-2 text-right">{c.atendidos}</td>
                        <td className="px-3 py-2 text-right">{c.vendas}</td>
                        <td className="px-3 py-2 text-right">{c.locacoes}</td>
                        <td className="px-3 py-2 text-right">{c.conversao}%</td>
                        <td className="px-3 py-2 text-right">{brl(Number(c.receita))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Desempenho por equipe */}
          {(data.escopo.is_admin || data.escopo.is_exec) && (
            <section className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4">Desempenho por equipe (Executivo)</h3>
              {data.equipes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Equipe</th>
                        <th className="px-3 py-2 text-right">Recebidos</th>
                        <th className="px-3 py-2 text-right">Atendidos</th>
                        <th className="px-3 py-2 text-right">Vendas</th>
                        <th className="px-3 py-2 text-right">Locações</th>
                        <th className="px-3 py-2 text-right">Conversão</th>
                        <th className="px-3 py-2 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.equipes.map((e) => (
                        <tr key={e.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{e.nome}</td>
                          <td className="px-3 py-2 text-right">{e.recebidos}</td>
                          <td className="px-3 py-2 text-right">{e.atendidos}</td>
                          <td className="px-3 py-2 text-right">{e.vendas}</td>
                          <td className="px-3 py-2 text-right">{e.locacoes}</td>
                          <td className="px-3 py-2 text-right">{e.conversao}%</td>
                          <td className="px-3 py-2 text-right">{brl(Number(e.receita))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Plantão */}
          <section className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="font-semibold mb-3 md:mb-4">Relatório do Plantão</h3>
            {data.plantao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Plantonista</th>
                      <th className="px-3 py-2 text-right">Leads recebidos</th>
                      <th className="px-3 py-2 text-right">Atendidos a tempo</th>
                      <th className="px-3 py-2 text-right">Redir. por demora</th>
                      <th className="px-3 py-2 text-right">Reatrib. (reincidência)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.plantao.map((p) => (
                      <tr key={p.id} className="border-t border-border">
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
            )}
          </section>

          {/* Origem dos leads */}
          <section className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="font-semibold mb-3 md:mb-4">Origem dos leads</h3>
            {origemChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <div className="min-w-[420px] md:min-w-0">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={origemChart}>
                        <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="qtd" fill="#c9a35b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={origemChart} dataKey="qtd" nameKey="canal" outerRadius={90} label>
                        {origemChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DeltaCard({ label, atual, d }: { label: string; atual: number | string; d: { txt: string; up: boolean | null } }) {
  const color = d.up === null ? "text-muted-foreground" : d.up ? "text-emerald-500" : "text-red-500";
  return (
    <div className="bg-background border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-1">{atual}</div>
      <div className={`text-xs mt-1 ${color}`}>{d.txt} vs período anterior</div>
    </div>
  );
}
