import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

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
      const { data, error } = await supabase.from("contratos").select("id,status,data_fim,valor_aluguel");
      if (error) throw error;
      return data ?? [];
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
  const receitaMensal = contratos
    .filter((c) => c.status === "ativo" || c.status === "vencendo")
    .reduce((s, c) => s + Number(c.valor_aluguel || 0), 0);

  const cards = [
    { label: "Imóveis", value: totalImoveis, icon: Building2 },
    { label: "Disponíveis", value: disponiveis, icon: CheckCircle2 },
    { label: "Locados", value: locados, icon: Building2 },
    { label: "Contratos ativos", value: ativos, icon: FileText },
  ];

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

      <Card>
        <CardHeader><CardTitle className="text-base">Receita mensal prevista (contratos ativos)</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{formatBRL(receitaMensal)}</CardContent>
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
                    <span>Contrato {c.id.slice(0, 8)}</span>
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
