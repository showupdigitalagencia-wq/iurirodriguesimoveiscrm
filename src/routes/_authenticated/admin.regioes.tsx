import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/regioes")({
  component: RegioesPage,
});

const REGIAO_LABELS: Record<string, string> = {
  barra_da_tijuca: "Barra da Tijuca",
  recreio: "Recreio",
  jacarepagua: "Jacarepaguá",
  zona_sul: "Zona Sul",
  zona_norte: "Zona Norte",
  zona_oeste: "Zona Oeste",
  centro: "Centro",
  outras: "Outras",
};

type Regiao = {
  regiao: string;
  recebidos: number;
  atendidos: number;
  fechados: number;
  vendas: number;
  locacoes: number;
  perdidos: number;
  receita: number;
  ticket_medio: number;
  conversao: number;
  tempo_medio_resposta_seg: number | null;
  anterior: { recebidos: number; fechados: number };
};

type Resp = {
  periodo: { from: string; to: string };
  escopo: { is_admin: boolean; is_exec: boolean; usuarios: number };
  regioes: Regiao[];
  totais: { recebidos: number; fechados: number; vendas: number; locacoes: number; receita: number };
};

function rangeFor(preset: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(to.getDate() - 7);
  else if (preset === "30d") from.setDate(to.getDate() - 30);
  else if (preset === "90d") from.setDate(to.getDate() - 90);
  else if (preset === "mes") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  else if (preset === "ano") { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }
  return { from, to };
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}
function fmtTempo(seg: number | null) {
  if (seg == null) return "—";
  if (seg < 60) return `${Math.round(seg)}s`;
  if (seg < 3600) return `${Math.round(seg / 60)}min`;
  return `${(seg / 3600).toFixed(1)}h`;
}

function RegioesPage() {
  const [preset, setPreset] = useState("30d");
  const [ordenar, setOrdenar] = useState<"conversao" | "receita" | "recebidos" | "fechados">("conversao");

  const { from, to } = useMemo(() => rangeFor(preset), [preset]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comparativo-regioes", preset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comparativo_regioes", {
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      if (error) throw error;
      return data as unknown as Resp;
    },
  });

  const regioesOrdenadas = useMemo(() => {
    if (!data?.regioes) return [];
    const arr = [...data.regioes];
    arr.sort((a, b) => {
      if (ordenar === "conversao") return b.conversao - a.conversao;
      if (ordenar === "receita") return b.receita - a.receita;
      if (ordenar === "fechados") return b.fechados - a.fechados;
      return b.recebidos - a.recebidos;
    });
    return arr;
  }, [data, ordenar]);

  const maxRecebidos = Math.max(1, ...regioesOrdenadas.map((r) => r.recebidos));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gold" /> Comparativo entre Regiões
          </h2>
          <p className="text-xs text-muted-foreground">
            Performance de vendas agrupada por região no período selecionado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordenar} onValueChange={(v) => setOrdenar(v as typeof ordenar)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conversao">Ordenar por conversão</SelectItem>
              <SelectItem value="receita">Ordenar por receita</SelectItem>
              <SelectItem value="fechados">Ordenar por fechados</SelectItem>
              <SelectItem value="recebidos">Ordenar por leads</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {error && <div className="text-sm text-destructive">Erro ao carregar dados.</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Leads recebidos" value={data.totais.recebidos.toString()} />
            <KpiCard label="Fechados" value={data.totais.fechados.toString()} />
            <KpiCard label="Vendas" value={data.totais.vendas.toString()} />
            <KpiCard label="Locações" value={data.totais.locacoes.toString()} />
            <KpiCard label="Receita" value={fmtBRL(data.totais.receita)} />
          </div>

          {regioesOrdenadas.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum lead no período.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {regioesOrdenadas.map((r) => {
                const delta = r.recebidos - r.anterior.recebidos;
                const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                const tone = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-destructive" : "text-muted-foreground";
                const barPct = Math.round((r.recebidos / maxRecebidos) * 100);
                return (
                  <Card key={r.regiao}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{REGIAO_LABELS[r.regiao] ?? r.regiao}</span>
                        <span className={`text-xs inline-flex items-center gap-1 ${tone}`}>
                          <Icon className="h-3 w-3" />
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{r.recebidos} leads</span>
                          <span>{r.conversao}% conversão</span>
                        </div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-gold" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Stat label="Atendidos" value={r.atendidos.toString()} />
                        <Stat label="Fechados" value={r.fechados.toString()} />
                        <Stat label="Vendas" value={r.vendas.toString()} />
                        <Stat label="Locações" value={r.locacoes.toString()} />
                        <Stat label="Perdidos" value={r.perdidos.toString()} />
                        <Stat label="Tempo resp." value={fmtTempo(r.tempo_medio_resposta_seg)} />
                      </div>
                      <div className="pt-2 border-t flex items-center justify-between text-xs">
                        <div>
                          <div className="text-muted-foreground">Receita</div>
                          <div className="font-semibold">{fmtBRL(r.receita)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Ticket médio</div>
                          <div className="font-semibold">{fmtBRL(r.ticket_medio)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Ranking detalhado</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Região</th>
                    <th className="text-right py-2 px-2">Leads</th>
                    <th className="text-right py-2 px-2">Atendidos</th>
                    <th className="text-right py-2 px-2">Fechados</th>
                    <th className="text-right py-2 px-2">Conv.</th>
                    <th className="text-right py-2 px-2">Receita</th>
                    <th className="text-right py-2 px-2">Ticket médio</th>
                    <th className="text-right py-2 px-2">Tempo resp.</th>
                  </tr>
                </thead>
                <tbody>
                  {regioesOrdenadas.map((r) => (
                    <tr key={r.regiao} className="border-b last:border-0">
                      <td className="py-2 px-2 font-medium">{REGIAO_LABELS[r.regiao] ?? r.regiao}</td>
                      <td className="text-right py-2 px-2">{r.recebidos}</td>
                      <td className="text-right py-2 px-2">{r.atendidos}</td>
                      <td className="text-right py-2 px-2">{r.fechados}</td>
                      <td className="text-right py-2 px-2">{r.conversao}%</td>
                      <td className="text-right py-2 px-2">{fmtBRL(r.receita)}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(r.ticket_medio)}</td>
                      <td className="text-right py-2 px-2">{fmtTempo(r.tempo_medio_resposta_seg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
