import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VENDAS_ETAPAS, formatBRL, type VendasLead } from "@/lib/vendas-helpers";
import { VendasLeadDetail } from "@/components/vendas-lead-detail";

export const Route = createFileRoute("/_authenticated/vendas/pipeline")({
  component: VendasPipeline,
});

function VendasPipeline() {
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me_vendas_pipeline_ctx"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id ?? null;
      if (!uid) return { isAdmin: false };
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return { isAdmin: roles?.some((r) => r.role === "admin") ?? false };
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["vendas_leads_pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendasLead[];
    },
  });

  return (
    <div className="overflow-x-auto pb-4">
      <VendasLeadDetail
        leadId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        isAdmin={me?.isAdmin ?? false}
        onChanged={() => qc.invalidateQueries({ queryKey: ["vendas_leads_pipeline"] })}
      />
      <div className="flex gap-3 min-w-max">
        {VENDAS_ETAPAS.map((etapa) => {
          const items = leads.filter((l) => l.etapa === etapa.id);
          return (
            <div key={etapa.id} className="w-72 shrink-0">
              <div className={`rounded-t-md px-3 py-2 border ${etapa.color} flex items-center justify-between`}>
                <span className="text-sm font-semibold">{etapa.emoji} {etapa.nome}</span>
                <span className="text-xs">{items.length}</span>
              </div>
              <div className="border border-t-0 rounded-b-md bg-card p-2 space-y-2 min-h-[200px]">
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">Vazio</div>
                )}
                {items.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setDetailId(l.id)}
                    className="w-full text-left rounded-md border p-2.5 bg-background hover:bg-muted/40 transition"
                  >
                    <div className="text-sm font-medium truncate">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">{l.tipo === "compra" ? "Compra" : "Locação"}</div>
                    <div className="text-xs mt-1">{formatBRL(l.valor != null ? Number(l.valor) : null)}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
