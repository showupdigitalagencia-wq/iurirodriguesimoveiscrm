import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VENDAS_ETAPAS, formatBRL, type VendasLead } from "@/lib/vendas-helpers";
import { VendasLeadDetail } from "@/components/vendas-lead-detail";
import { Termometro, tendenciaFromTemperaturas } from "@/components/termometro";
import { UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas/pipeline")({
  component: VendasPipeline,
});

type VendasLeadExt = VendasLead & { atribuicao_status?: "pendente" | "aceito" | "recusado" | null };

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
      return (data ?? []) as VendasLeadExt[];
    },
  });

  const corretorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of leads) if (l.corretor_id) ids.add(l.corretor_id);
    return Array.from(ids);
  }, [leads]);

  const { data: corretores = [] } = useQuery({
    queryKey: ["vendas_pipeline_corretores", corretorIds.sort().join(",")],
    enabled: corretorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").in("id", corretorIds);
      return (data ?? []) as Array<{ id: string; nome: string | null }>;
    },
  });

  const nomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of corretores) if (c.id) m.set(c.id, c.nome ?? "—");
    return m;
  }, [corretores]);

  return (
    <div className="p-4 md:p-6">
      <p className="text-xs text-muted-foreground mb-3 md:hidden">Deslize as colunas para o lado.</p>
      <div className="overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0">
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
            const hex = etapa.hex;
            return (
              <div key={etapa.id} className="w-[85vw] sm:w-72 shrink-0 snap-center">
                <div
                  className="relative rounded-t-lg px-3 py-2.5 flex items-center justify-between border border-b-0 border-border/50 backdrop-blur-md"
                  style={{
                    background: `linear-gradient(180deg, ${hex}22, transparent)`,
                  }}
                >
                  <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: hex, boxShadow: `0 0 12px ${hex}` }} />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/90">
                    {etapa.emoji} {etapa.nome}
                  </span>
                  <span
                    className="text-[10px] font-medium rounded-full px-2 py-0.5 border"
                    style={{ color: hex, borderColor: `${hex}55`, background: `${hex}15` }}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="border border-t-0 border-border/50 rounded-b-lg bg-card/40 backdrop-blur-sm p-2 space-y-2 min-h-[200px]">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">Vazio</div>
                  )}
                  {items.map((l) => {
                    const sc = (l as unknown as { score_temperatura: number | null }).score_temperatura ?? null;
                    const tp = (l as unknown as { temperatura: "frio" | "morno" | "quente" | null }).temperatura ?? null;
                    const tpAnt = (l as unknown as { temperatura_anterior: string | null }).temperatura_anterior ?? null;
                    const trend = tendenciaFromTemperaturas(tp, tpAnt);
                    const corretorNome = l.corretor_id ? nomeById.get(l.corretor_id) : null;
                    const pendente = l.atribuicao_status === "pendente";
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setDetailId(l.id)}
                        style={{ borderLeftColor: hex }}
                        className="w-full text-left rounded-md border border-border/60 border-l-[3px] p-2.5 bg-background/60 hover:bg-muted/40 hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{l.nome}</div>
                            <div className="text-xs text-muted-foreground">{l.tipo === "compra" ? "Compra" : "Locação"}</div>
                            <div className="text-xs mt-1">{formatBRL(l.valor != null ? Number(l.valor) : null)}</div>
                          </div>
                          {sc !== null && <Termometro score={sc} temperatura={tp} tendencia={trend} size="sm" />}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] min-w-0">
                          <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {corretorNome ? (
                            <>
                              <span className="truncate text-foreground/80">{corretorNome}</span>
                              {pendente && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-700 border-yellow-300 text-[10px]">
                                  aguardando
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">Sem corretor</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

