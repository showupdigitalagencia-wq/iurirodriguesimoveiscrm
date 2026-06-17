import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type Pagamento = {
  id: string; contrato_id: string; mes_referencia: string;
  valor_previsto: number; valor_pago: number | null;
  status: "pago" | "atrasado" | "pendente" | "inadimplente";
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function AdminDashboard() {
  const { data: imoveis = [] } = useQuery({
    queryKey: ["admin_imoveis_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("imoveis").select("id,status,valor_aluguel");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["admin_contratos_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("id,status,data_fim,valor_aluguel,locatario_nome");
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

  // Métricas de pagamento
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const pagsMes = pagamentos.filter((p) => p.mes_referencia.startsWith(mesAtual));
  const previstoMes = pagsMes.reduce((s, p) => s + Number(p.valor_previsto || 0), 0);
  const recebidoMes = pagsMes.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const atrasados = pagamentos.filter((p) => p.status === "atrasado" || p.status === "inadimplente");
  const totalPags = pagamentos.length || 1;
  const taxaInad = (atrasados.length / totalPags) * 100;

  // Bons pagadores: contratos sem nenhum atraso histórico
  const contratosComAtraso = new Set(atrasados.map((p) => p.contrato_id));
  const bonsPagadores = contratos.filter((c) => !contratosComAtraso.has(c.id));

  // Sem atraso nos últimos 6 meses
  const seisMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1);
  const atrasoRecente = new Set(
    pagamentos
      .filter((p) => (p.status === "atrasado" || p.status === "inadimplente") && new Date(p.mes_referencia) >= seisMeses)
      .map((p) => p.contrato_id)
  );
  const semAtraso6m = contratos.filter((c) => !atrasoRecente.has(c.id));

  const cards = [
    { label: "Imóveis", value: totalImoveis, icon: Building2 },
    { label: "Disponíveis", value: disponiveis, icon: CheckCircle2 },
    { label: "Locados", value: locados, icon: Building2 },
    { label: "Contratos ativos", value: ativos, icon: FileText },
  ];

  // Gráfico simples — últimos 6 meses previsto vs recebido
  const chart: { mes: string; previsto: number; recebido: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ps = pagamentos.filter((p) => p.mes_referencia.startsWith(key));
    chart.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      previsto: ps.reduce((s, p) => s + Number(p.valor_previsto || 0), 0),
      recebido: ps.reduce((s, p) => s + Number(p.valor_pago || 0), 0),
    });
  }
  const maxBar = Math.max(1, ...chart.map((c) => Math.max(c.previsto, c.recebido)));

  return (
    <div className="space-y-6">
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
              <TrendingUp className="h-3 w-3" /> Receita prevista (mês)
            </div>
            <div className="text-xl font-semibold">{formatBRL(previstoMes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Receita recebida (mês)
            </div>
            <div className="text-xl font-semibold">{formatBRL(recebidoMes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Taxa de inadimplência
            </div>
            <div className="text-xl font-semibold">{taxaInad.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Previsto vs Recebido (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {chart.map((c) => (
              <div key={c.mes} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{c.mes}</span>
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

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bons pagadores</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="text-2xl font-bold mb-1">{bonsPagadores.length}</div>
            <div className="text-xs text-muted-foreground">Nunca atrasaram</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Sem atraso (6 meses)</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="text-2xl font-bold mb-1">{semAtraso6m.length}</div>
            <div className="text-xs text-muted-foreground">Locatários em dia</div>
          </CardContent>
        </Card>
      </div>

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
