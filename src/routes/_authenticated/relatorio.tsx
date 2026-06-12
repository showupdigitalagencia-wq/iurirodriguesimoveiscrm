import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { ETAPAS, CANAIS, etapaNome, canalNome, type LeadRow } from "@/lib/lead-helpers";

export const Route = createFileRoute("/_authenticated/relatorio")({
  head: () => ({ meta: [{ title: "Relatórios — CRM" }] }),
  component: RelatorioPage,
});

const COLORS = ["#c9a35b", "#8b6f3a", "#6c512a", "#a8893f", "#d4b06a"];

function RelatorioPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  useEffect(() => {
    supabase.from("leads").select("*").then(({ data }) => setLeads((data as LeadRow[]) ?? []));
  }, []);

  const porEtapa = ETAPAS.map((e) => ({ nome: e.nome, qtd: leads.filter((l) => l.etapa === e.id).length }));
  const porCanal = CANAIS.map((c) => ({ name: c.nome, value: leads.filter((l) => l.canal === c.id).length }));
  const ganhos = leads.filter((l) => l.etapa === "fechado_ganho").length;
  const perdidos = leads.filter((l) => l.etapa === "fechado_perdido").length;
  const taxa = ganhos + perdidos > 0 ? Math.round((ganhos / (ganhos + perdidos)) * 100) : 0;

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Taxa de conversão: <span className="font-semibold text-gold">{taxa}%</span></p>
      </header>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Leads por etapa</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porEtapa}>
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qtd" fill="#c9a35b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Distribuição por canal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={porCanal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                {porCanal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
