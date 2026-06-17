import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, FileText, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type Pagamento = {
  id: string; contrato_id: string; mes_referencia: string;
  valor_previsto: number; valor_pago: number | null;
  data_pagamento: string | null;
  status: "pago" | "atrasado" | "pendente" | "inadimplente";
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function AdminDashboard() {
  const [preset, setPreset] = useState<"7" | "15" | "30" | "60" | "90" | "custom">("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { startDate, endDate, prevStart, prevEnd, days } = useMemo(() => {
    const end = preset === "custom" && customEnd ? new Date(customEnd) : new Date();
    let start: Date;
    if (preset === "custom" && customStart) {
      start = new Date(customStart);
    } else {
      const n = Number(preset === "custom" ? "30" : preset);
      start = new Date(end);
      start.setDate(end.getDate() - n);
    }
    const ms = end.getTime() - start.getTime();
    const prevE = new Date(start);
    const prevS = new Date(start.getTime() - ms);
    return {
      startDate: start, endDate: end,
      prevStart: prevS, prevEnd: prevE,
      days: Math.max(1, Math.round(ms / 86400000)),
    };
  }, [preset, customStart, customEnd]);

  const { data: imoveis = [] } = useQuery({
    queryKey: ["admin_imoveis_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("imoveis").select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["admin_contratos_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("id,status,data_inicio,data_fim,valor_aluguel,locatario_nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["admin_pagamentos_dash"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pagamentos").select("*");
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });

  const totalImoveis = imoveis.length;
  const disponiveis = imoveis.filter((i) => i.status === "disponivel").length;
  const locados = imoveis.filter((i) => i.status === "locado").length;
  const ativos = contratos.filter((c) => c.status === "ativo" || c.status === "vencendo").length;
  const hoje = new Date();
  const em90 = new Date(); em90.setDate(hoje.getDate() + 90);
  const vencendo = contratos.filter((c) => {
    if (c.status !== "ativo" && c.status !== "vencendo") return false;
    const f = new Date(c.data_fim);
    return f >= hoje && f <= em90;
  });

  // Filtra pagamentos pelo período (por mes_referencia ou data_pagamento)
  const inRange = (dateStr: string | null | undefined, s: Date, e: Date) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= s && d <= e;
  };

  const pagsPeriodo = pagamentos.filter((p) => {
    const ref = new Date(p.mes_referencia);
    return ref >= startDate && ref <= endDate;
  });
  const previsto = pagsPeriodo.reduce((s, p) => s + Number(p.valor_previsto || 0), 0);
  const recebido = pagsPeriodo.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const atrasadosPer = pagsPeriodo.filter((p) => p.status === "atrasado" || p.status === "inadimplente");
  const taxaInad = pagsPeriodo.length ? (atrasadosPer.length / pagsPeriodo.length) * 100 : 0;

  // Bons pagadores no período
  const contratosComAtrasoPer = new Set(atrasadosPer.map((p) => p.contrato_id));
  const bonsPagadores = contratos.filter((c) => !contratosComAtrasoPer.has(c.id));

  // Novos contratos no período (data_inicio)
  const novosContratos = contratos.filter((c: any) => inRange(c.data_inicio, startDate, endDate));

  // Imóveis vendidos no período
  const vendidosPer = imoveis.filter((i) => i.status === "vendido" && inRange(i.data_venda, startDate, endDate));
  const vendidosPrev = imoveis.filter((i) => i.status === "vendido" && inRange(i.data_venda, prevStart, prevEnd));
  const valorVendasPer = vendidosPer.reduce((s, i) => s + Number(i.valor_venda || 0), 0);
  const valorVendasPrev = vendidosPrev.reduce((s, i) => s + Number(i.valor_venda || 0), 0);
  const deltaVendidos = vendidosPer.length - vendidosPrev.length;
  const deltaValor = valorVendasPer - valorVendasPrev;

  const cards = [
    { label: "Imóveis", value: totalImoveis, icon: Building2 },
    { label: "Disponíveis", value: disponiveis, icon: CheckCircle2 },
    { label: "Locados", value: locados, icon: Building2 },
    { label: "Contratos ativos", value: ativos, icon: FileText },
  ];

  // Gráfico — buckets ao longo do período
  const buckets = Math.min(12, Math.max(4, Math.ceil(days / 7)));
  const step = days / buckets;
  const chart: { label: string; previsto: number; recebido: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const s = new Date(startDate.getTime() + i * step * 86400000);
    const e = new Date(startDate.getTime() + (i + 1) * step * 86400000);
    const ps = pagamentos.filter((p) => {
      const ref = new Date(p.mes_referencia);
      return ref >= s && ref < e;
    });
    chart.push({
      label: s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      previsto: ps.reduce((sum, p) => sum + Number(p.valor_previsto || 0), 0),
      recebido: ps.reduce((sum, p) => sum + Number(p.valor_pago || 0), 0),
    });
  }
  const maxBar = Math.max(1, ...chart.map((c) => Math.max(c.previsto, c.recebido)));

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <>
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {toISO(startDate)} → {toISO(endDate)} ({days} dias)
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="text-xl font-semibold">{c.value}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Receita prevista (período)
            </div>
            <div className="text-xl font-semibold">{formatBRL(previsto)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Receita recebida (período)
            </div>
            <div className="text-xl font-semibold">{formatBRL(recebido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Taxa de inadimplência (período)
            </div>
            <div className="text-xl font-semibold">{taxaInad.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Vendidos no período */}
      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Imóveis vendidos (período)
            </div>
            <div className="text-xl font-semibold">{vendidosPer.length}</div>
            <div className={`text-xs mt-1 ${deltaVendidos >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {deltaVendidos >= 0 ? "+" : ""}{deltaVendidos} vs período anterior ({vendidosPrev.length})
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Valor total em vendas
            </div>
            <div className="text-xl font-semibold">{formatBRL(valorVendasPer)}</div>
            <div className={`text-xs mt-1 ${deltaValor >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {deltaValor >= 0 ? "+" : ""}{formatBRL(deltaValor)} vs período anterior
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Novos contratos (período)
            </div>
            <div className="text-xl font-semibold">{novosContratos.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Previsto vs Recebido no período</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {chart.map((c, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{c.label}</span>
                  <span className="text-muted-foreground">{formatBRL(c.recebido)} / {formatBRL(c.previsto)}</span>
                </div>
                <div className="relative h-3 bg-muted rounded overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-muted-foreground/30" style={{ width: `${(c.previsto / maxBar) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(c.recebido / maxBar) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Bons pagadores (período)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <div className="text-2xl font-bold mb-1">{bonsPagadores.length}</div>
          <div className="text-xs text-muted-foreground">Sem atraso no período selecionado</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Contratos vencendo em até 90 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {vencendo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato no período.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {vencendo.map((c) => {
                const dias = Math.ceil((new Date(c.data_fim).getTime() - hoje.getTime()) / 86400000);
                const cor = dias <= 30 ? "text-destructive" : dias <= 60 ? "text-amber-600" : "text-muted-foreground";
                return (
                  <li key={c.id} className="flex justify-between border-b pb-1">
                    <span>{c.locatario_nome}</span>
                    <span className={cor}>vence em {dias} dia{dias === 1 ? "" : "s"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
