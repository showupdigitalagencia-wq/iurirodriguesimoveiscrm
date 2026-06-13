import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, CheckCircle2 } from "lucide-react";
import { ETAPAS, etapaColor, type LeadRow } from "@/lib/lead-helpers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sistema NEXUS" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);

  useEffect(() => {
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setLeads((data as LeadRow[]) ?? []);
    });
  }, []);

  const total = leads.length;
  const novos = leads.filter((l) => l.etapa === "novos_leads").length;
  const ganhos = leads.filter((l) => l.etapa === "fechado").length;
  const emAtendimento = leads.filter((l) => l.etapa === "em_atendimento").length;

  const cards = [
    { label: "Total de leads", value: total, icon: Users, color: "text-foreground" },
    { label: "Novos leads", value: novos, icon: Clock, color: "text-gold" },
    { label: "Em atendimento", value: emAtendimento, icon: Clock, color: "text-gold" },
    { label: "Fechados", value: ganhos, icon: CheckCircle2, color: "text-green-600" },
  ];

  const porEtapa = ETAPAS.map((e) => ({
    etapa: e,
    count: leads.filter((l) => l.etapa === e.id).length,
  }));

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1">Visão geral do funil de vendas.</p>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs md:text-sm text-muted-foreground truncate">{c.label}</span>
                <Icon className={`h-5 w-5 shrink-0 ${c.color}`} />
              </div>
              <div className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <section className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h2 className="font-semibold mb-3 md:mb-4">Leads por etapa</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {porEtapa.map(({ etapa, count }) => (
            <Link key={etapa.id} to="/pipeline"
              className={`flex items-center justify-between gap-2 p-3 min-h-11 rounded-md border-l-4 ${etapaColor(etapa.id).border} bg-muted/40 hover:bg-muted transition-colors`}>
              <span className="flex items-center gap-2 text-sm truncate">
                <span className={`h-2.5 w-2.5 rounded-full ${etapaColor(etapa.id).dot}`} />
                <span className="truncate">{etapa.nome}</span>
              </span>
              <span className="font-semibold shrink-0">{count}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
