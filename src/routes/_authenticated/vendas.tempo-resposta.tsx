import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw, AlertTriangle, Trophy } from "lucide-react";

type RankingRow = {
  corretor_id: string;
  nome: string | null;
  equipe: string | null;
  total_leads: number;
  respondidos: number;
  pendentes: number;
  tempo_medio_seg: number | null;
  tempo_min_seg: number | null;
  tempo_max_seg: number | null;
};

type Aguardando = {
  id: string;
  nome: string;
  telefone: string | null;
  created_at: string;
  corretor_id: string | null;
  corretor_nome: string | null;
  segundos_aguardando: number;
};

type Resp = {
  periodo: { from: string; to: string };
  escopo: { is_admin: boolean; is_exec: boolean; scope: string; usuarios: number };
  media_geral_seg: number | null;
  total_respondidos: number;
  ranking: RankingRow[];
  aguardando: Aguardando[];
};

export const Route = createFileRoute("/_authenticated/vendas/tempo-resposta")({
  component: TempoRespostaPage,
});

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function fmtSeg(seg: number | null | undefined): string {
  if (seg == null) return "—";
  if (seg < 60) return `${Math.round(seg)}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h${m ? ` ${m}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function TempoRespostaPage() {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59`).toISOString();
      const { data: res, error } = await supabase.rpc("get_tempo_resposta_ranking" as never, {
        _from: fromIso,
        _to: toIso,
        _scope: "auto",
        _target: null,
      } as never);
      if (error) throw error;
      setData(res as unknown as Resp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escopoLabel = data?.escopo.is_admin
    ? "Ranking geral (admin)"
    : data?.escopo.is_exec
      ? "Ranking da equipe (executivo)"
      : "Meu tempo médio";

  const mostrarRanking = !!data && (data.escopo.is_admin || data.escopo.is_exec);

  const meuItem = useMemo(() => {
    if (!data || mostrarRanking) return null;
    return data.ranking[0] ?? null;
  }, [data, mostrarRanking]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-gold" />
        <h2 className="text-lg md:text-xl font-semibold">Tempo de Resposta</h2>
        {data && <span className="text-xs text-muted-foreground">— {escopoLabel}</span>}
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
          <Button onClick={load} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {err && (
        <Card className="border-red-300">
          <CardContent className="pt-4 text-sm text-red-600">{err}</CardContent>
        </Card>
      )}

      {/* KPI / Card individual */}
      {data && !mostrarRanking && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Meu desempenho</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Tempo médio" value={fmtSeg(meuItem?.tempo_medio_seg ?? null)} />
            <Kpi label="Leads respondidos" value={String(meuItem?.respondidos ?? 0)} />
            <Kpi label="Mais rápido" value={fmtSeg(meuItem?.tempo_min_seg ?? null)} />
            <Kpi label="Mais lento" value={fmtSeg(meuItem?.tempo_max_seg ?? null)} />
          </CardContent>
        </Card>
      )}

      {data && mostrarRanking && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Ranking — menor é melhor
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                média geral: {fmtSeg(data.media_geral_seg)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Corretor</th>
                  <th className="text-left py-2 pr-3">Equipe</th>
                  <th className="text-right py-2 pr-3">Tempo médio</th>
                  <th className="text-right py-2 pr-3">Respondidos</th>
                  <th className="text-right py-2 pr-3">Pendentes</th>
                  <th className="text-right py-2">Min / Máx</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r, idx) => (
                  <tr key={r.corretor_id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-3 font-medium">{r.nome ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.equipe ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{fmtSeg(r.tempo_medio_seg)}</td>
                    <td className="py-2 pr-3 text-right">{r.respondidos}</td>
                    <td className="py-2 pr-3 text-right">
                      {r.pendentes > 0 ? (
                        <Badge variant="destructive" className="font-normal">{r.pendentes}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-xs text-muted-foreground">
                      {fmtSeg(r.tempo_min_seg)} / {fmtSeg(r.tempo_max_seg)}
                    </td>
                  </tr>
                ))}
                {data.ranking.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">Sem dados no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {data && data.aguardando.length > 0 && (
        <Card className="border-amber-300/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Aguardando primeiro contato ({data.aguardando.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Lead</th>
                  <th className="text-left py-2 pr-3">Telefone</th>
                  <th className="text-left py-2 pr-3">Corretor</th>
                  <th className="text-right py-2">Aguardando há</th>
                </tr>
              </thead>
              <tbody>
                {data.aguardando.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{a.nome}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.telefone ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.corretor_nome ?? "—"}</td>
                    <td className="py-2 text-right font-mono text-xs">
                      {fmtSeg(a.segundos_aguardando)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg md:text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
