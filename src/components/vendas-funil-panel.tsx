import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, RefreshCw, TrendingDown } from "lucide-react";
import { ETAPAS } from "@/lib/lead-helpers";
import { VENDAS_ETAPAS } from "@/lib/vendas-helpers";

type EtapaItem = { id: string; atual: number; passaram: number };
type FunilResult = {
  pipeline: "captacao" | "vendas";
  etapas: EtapaItem[];
  escopo: { is_admin: boolean; is_exec: boolean; scope: string; usuarios: number };
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function nomeEtapa(pipeline: "captacao" | "vendas", id: string): string {
  if (pipeline === "captacao") return ETAPAS.find((e) => e.id === id)?.nome ?? id;
  return VENDAS_ETAPAS.find((e) => e.id === id)?.nome ?? id;
}

export function VendasFunilPanel() {
  const initial = defaultRange();
  const [pipeline, setPipeline] = useState<"captacao" | "vendas">("vendas");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FunilResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIsoStr = new Date(`${to}T23:59:59`).toISOString();
      const { data: res, error } = await supabase.rpc("get_funil_conversao" as never, {
        _pipeline: pipeline,
        _from: fromIso,
        _to: toIsoStr,
        _scope: "auto",
        _target: null,
      } as never);
      if (error) throw error;
      setData(res as unknown as FunilResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline]);

  const maxPassaram = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.etapas.map((e) => e.passaram));
  }, [data]);

  const escopoLabel = data?.escopo.is_admin
    ? "Visão geral (admin)"
    : data?.escopo.is_exec
      ? "Visão da equipe (executivo)"
      : "Meu funil";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingDown className="h-5 w-5 text-gold" />
        <h2 className="text-lg md:text-xl font-semibold">Funil de Conversão</h2>
        {data && <span className="text-xs text-muted-foreground">— {escopoLabel}</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Pipeline</label>
            <Select value={pipeline} onValueChange={(v) => setPipeline(v as "captacao" | "vendas")}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="captacao">Captação de Corretores</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {pipeline === "vendas" ? "Pipeline de Vendas" : "Pipeline de Captação"}
            {data && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({data.escopo.usuarios} usuário(s) no escopo)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {loading ? "Carregando..." : "Sem dados"}
            </div>
          ) : (
            <div className="space-y-2">
              {data.etapas.map((etapa, idx) => {
                const prev = idx > 0 ? data.etapas[idx - 1] : null;
                const conv = prev && prev.passaram > 0 ? (etapa.passaram / prev.passaram) * 100 : null;
                const widthPct = (etapa.passaram / maxPassaram) * 100;
                return (
                  <div key={etapa.id}>
                    {prev && (
                      <div className="flex items-center gap-2 pl-4 py-1 text-xs text-muted-foreground">
                        <TrendingDown className="h-3 w-3" />
                        <span>
                          Conversão: <strong className={conv !== null && conv < 50 ? "text-red-600" : "text-foreground"}>
                            {conv === null ? "—" : `${conv.toFixed(1)}%`}
                          </strong>
                        </span>
                      </div>
                    )}
                    <div className="flex items-stretch gap-3">
                      <div className="w-[180px] md:w-[200px] shrink-0 text-sm font-medium py-2">
                        {nomeEtapa(pipeline, etapa.id)}
                      </div>
                      <div className="flex-1 relative bg-muted/30 rounded">
                        <div
                          className="h-full rounded bg-gold/20 border border-gold/40 transition-all"
                          style={{ width: `${Math.max(widthPct, 2)}%`, minHeight: 40 }}
                        />
                        <div className="absolute inset-0 flex items-center px-3 text-sm flex-wrap">
                          <span className="font-semibold">{etapa.passaram}</span>
                          <span className="text-muted-foreground ml-1">passaram</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="font-semibold">{etapa.atual}</span>
                          <span className="text-muted-foreground ml-1">agora</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            <strong>Passaram</strong>: leads que entraram nesta etapa no período (histórico de mudanças).{" "}
            <strong>Agora</strong>: leads atualmente nesta etapa (entre os criados no período).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
