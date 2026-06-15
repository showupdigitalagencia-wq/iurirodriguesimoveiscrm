import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VENDAS_ETAPAS, formatBRL, type VendasLead } from "@/lib/vendas-helpers";
import { TrendingUp, Users, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas/")({
  component: VendasDashboard,
});

function VendasDashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ["vendas_leads_dash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_leads")
        .select("id, etapa, valor, created_at, tipo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<VendasLead, "id" | "etapa" | "valor" | "created_at" | "tipo">[];
    },
  });

  const total = leads.length;
  const fechados = leads.filter((l) => l.etapa === "fechado").length;
  const perdidos = leads.filter((l) => l.etapa === "perdido").length;
  const conversao = total > 0 ? Math.round((fechados / total) * 100) : 0;
  const ticketMedio = fechados > 0
    ? leads.filter((l) => l.etapa === "fechado" && l.valor != null).reduce((s, l) => s + Number(l.valor ?? 0), 0) / fechados
    : 0;

  const porEtapa = VENDAS_ETAPAS.map((e) => ({
    ...e,
    count: leads.filter((l) => l.etapa === e.id).length,
  }));

  const cards = [
    { label: "Total de Leads", value: total, icon: Users },
    { label: "Fechados", value: fechados, icon: CheckCircle2 },
    { label: "Perdidos", value: perdidos, icon: XCircle },
    { label: "Conversão", value: `${conversao}%`, icon: TrendingUp },
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
        <CardHeader><CardTitle className="text-base">Ticket médio (fechados)</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{formatBRL(ticketMedio || null)}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por Etapa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {porEtapa.map((e) => (
              <div key={e.id} className={`rounded-md border px-3 py-2 ${e.color}`}>
                <div className="text-xs flex items-center gap-1">{e.emoji} {e.nome}</div>
                <div className="text-xl font-bold">{e.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
