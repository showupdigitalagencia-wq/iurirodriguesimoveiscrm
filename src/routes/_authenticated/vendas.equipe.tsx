import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, type VendasLead } from "@/lib/vendas-helpers";
import { VendasLeadDetail } from "@/components/vendas-lead-detail";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Sparkles, PhoneOff, CalendarCheck, Handshake, Trophy,
  TrendingUp, Timer, Hourglass, DollarSign, Loader2, ChevronRight,
  FileText, Clock, Zap, Medal,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas/equipe")({
  head: () => ({ meta: [{ title: "Minha Equipe — Vendas" }, { name: "robots", content: "noindex" }] }),
  component: MinhaEquipePage,
});

type Profile = { id: string; nome: string | null; responsavel_id: string | null; vendas_acesso: boolean | null };

type MetricKey =
  | "total" | "novos" | "sem_contato" | "visita_agendada"
  | "negociacao" | "fechados";

type CorretorStats = {
  corretor: Profile;
  leads: VendasLead[];
  total: number;
  novos: number;
  semContato: number;
  visitaAgendada: number;
  negociacao: number;
  fechados: number;
  propostasEnviadas: number;
  followUpPendentes: number;
  visitasRealizadas: number;
  ultimaMovimentacao: Date | null;
  ultimoAtendimento: Date | null;
  conversao: number;              // %
  tempoMedioResposta: number | null; // minutos
  tempoParado: number | null;     // dias médios desde updated_at (leads ativos)
  valorNegociacao: number;
  valorVendido: number;
};

const NEGOCIACAO_ETAPAS = new Set(["proposta_enviada", "em_negociacao"]);
const ATIVAS = new Set(["novo_lead", "contato_realizado", "visita_agendada", "proposta_enviada", "em_negociacao", "follow_up"]);

function statsFor(profile: Profile, leads: VendasLead[], visitasRealizadas: number): CorretorStats {
  const total = leads.length;
  const novos = leads.filter((l) => l.etapa === "novo_lead").length;
  const semContato = leads.filter((l) => !l.first_response_at && l.etapa !== "fechado" && l.etapa !== "perdido").length;
  const visitaAgendada = leads.filter((l) => l.etapa === "visita_agendada").length;
  const negociacao = leads.filter((l) => NEGOCIACAO_ETAPAS.has(l.etapa)).length;
  const propostasEnviadas = leads.filter((l) => l.etapa === "proposta_enviada").length;
  const followUpPendentes = leads.filter((l) => l.etapa === "follow_up").length;
  const fechados = leads.filter((l) => l.etapa === "fechado").length;
  const decididos = fechados + leads.filter((l) => l.etapa === "perdido").length;
  const conversao = decididos > 0 ? (fechados / decididos) * 100 : 0;

  const respondidos = leads.filter((l) => l.first_response_at);
  const tempoMedioResposta = respondidos.length
    ? respondidos.reduce((s, l) => s + (new Date(l.first_response_at!).getTime() - new Date(l.created_at).getTime()), 0)
      / respondidos.length / 60000
    : null;

  const ativos = leads.filter((l) => ATIVAS.has(l.etapa));
  const now = Date.now();
  const tempoParado = ativos.length
    ? ativos.reduce((s, l) => s + (now - new Date(l.updated_at).getTime()), 0) / ativos.length / 86400000
    : null;

  const ultimaMovimentacao = leads.length
    ? new Date(Math.max(...leads.map((l) => new Date(l.updated_at).getTime())))
    : null;
  const respostas = leads.filter((l) => l.first_response_at).map((l) => new Date(l.first_response_at!).getTime());
  const ultimoAtendimento = respostas.length ? new Date(Math.max(...respostas)) : null;

  const valorNegociacao = leads
    .filter((l) => NEGOCIACAO_ETAPAS.has(l.etapa))
    .reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const valorVendido = leads
    .filter((l) => l.etapa === "fechado")
    .reduce((s, l) => s + (Number(l.valor) || 0), 0);

  return {
    corretor: profile,
    leads,
    total, novos, semContato, visitaAgendada, negociacao, fechados,
    propostasEnviadas, followUpPendentes, visitasRealizadas,
    ultimaMovimentacao, ultimoAtendimento,
    conversao, tempoMedioResposta, tempoParado, valorNegociacao, valorVendido,
  };
}

function filterLeads(leads: VendasLead[], key: MetricKey): VendasLead[] {
  switch (key) {
    case "total": return leads;
    case "novos": return leads.filter((l) => l.etapa === "novo_lead");
    case "sem_contato": return leads.filter((l) => !l.first_response_at && l.etapa !== "fechado" && l.etapa !== "perdido");
    case "visita_agendada": return leads.filter((l) => l.etapa === "visita_agendada");
    case "negociacao": return leads.filter((l) => NEGOCIACAO_ETAPAS.has(l.etapa));
    case "fechados": return leads.filter((l) => l.etapa === "fechado");
  }
}

const METRIC_LABEL: Record<MetricKey, string> = {
  total: "Leads no total",
  novos: "Leads novos",
  sem_contato: "Sem contato",
  visita_agendada: "Visita agendada",
  negociacao: "Em negociação",
  fechados: "Fechados",
};

function initials(nome: string | null): string {
  if (!nome) return "?";
  return nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function fmtMin(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function fmtDays(d: number | null): string {
  if (d == null) return "—";
  return `${d.toFixed(1)}d`;
}

function MinhaEquipePage() {
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ stats: CorretorStats; key: MetricKey } | null>(null);

  const { data: me } = useQuery({
    queryKey: ["equipe_me_ctx"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id ?? null;
      if (!uid) return { uid: null, isAdmin: false, execId: null };
      const [{ data: roles }, { data: execRpc }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("current_user_executivo_id"),
      ]);
      return {
        uid,
        isAdmin: roles?.some((r) => r.role === "admin") ?? false,
        execId: (execRpc as string | null) ?? null,
      };
    },
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["equipe_leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendas_leads").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendasLead[];
    },
  });

  // Realtime: substitui o polling de 60s por atualização instantânea
  useRealtimeInvalidate(
    ["vendas_leads", "vendas_visitas"],
    [["equipe_leads"], ["equipe_visitas_realizadas"]],
  );

  const corretorIds = useMemo(() => Array.from(new Set(leads.map((l) => l.corretor_id).filter(Boolean) as string[])), [leads]);

  const { data: profiles = [], isLoading: loadingProf } = useQuery({
    queryKey: ["equipe_profiles", me?.execId ?? "all", corretorIds.sort().join(",")],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, nome, responsavel_id, vendas_acesso");
      if (me!.execId && !me!.isAdmin) q = q.eq("responsavel_id", me!.execId);
      else if (corretorIds.length > 0) q = q.in("id", corretorIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileIds = useMemo(() => profiles.map((p) => p.id).sort().join(","), [profiles]);
  const { data: visitasByCorretor = new Map<string, number>() } = useQuery({
    queryKey: ["equipe_visitas_realizadas", profileIds],
    enabled: profiles.length > 0,
    queryFn: async () => {
      const ids = profiles.map((p) => p.id);
      const { data } = await supabase
        .from("vendas_visitas")
        .select("corretor_id")
        .eq("comparecimento", "realizada")
        .in("corretor_id", ids);
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { corretor_id: string | null }[]) {
        if (r.corretor_id) m.set(r.corretor_id, (m.get(r.corretor_id) ?? 0) + 1);
      }
      return m;
    },
  });

  const perCorretor = useMemo(() => {
    const map = new Map<string, VendasLead[]>();
    for (const p of profiles) map.set(p.id, []);
    for (const l of leads) {
      if (l.corretor_id && map.has(l.corretor_id)) map.get(l.corretor_id)!.push(l);
    }
    return profiles
      .map((p) => statsFor(p, map.get(p.id) ?? [], visitasByCorretor.get(p.id) ?? 0))
      .sort((a, b) => b.total - a.total);
  }, [leads, profiles, visitasByCorretor]);

  // Ranking: top 1 por categoria
  const ranking = useMemo(() => {
    const withSales = perCorretor.filter((s) => s.fechados > 0);
    const withDecisoes = perCorretor.filter((s) => s.fechados + s.leads.filter((l) => l.etapa === "perdido").length > 0);
    const withResp = perCorretor.filter((s) => s.tempoMedioResposta != null);
    const withRev = perCorretor.filter((s) => s.valorVendido > 0);
    return {
      vendas: [...withSales].sort((a, b) => b.fechados - a.fechados)[0] ?? null,
      conversao: [...withDecisoes].sort((a, b) => b.conversao - a.conversao)[0] ?? null,
      resposta: [...withResp].sort((a, b) => (a.tempoMedioResposta ?? Infinity) - (b.tempoMedioResposta ?? Infinity))[0] ?? null,
      receita: [...withRev].sort((a, b) => b.valorVendido - a.valorVendido)[0] ?? null,
    };
  }, [perCorretor]);

  const teamTotals = useMemo(() => {
    const acc = perCorretor.reduce(
      (a, s) => {
        a.total += s.total; a.novos += s.novos; a.semContato += s.semContato;
        a.visitaAgendada += s.visitaAgendada; a.negociacao += s.negociacao; a.fechados += s.fechados;
        a.valorNegociacao += s.valorNegociacao; a.valorVendido += s.valorVendido;
        if (s.tempoMedioResposta != null) { a.respSum += s.tempoMedioResposta; a.respN += 1; }
        if (s.tempoParado != null) { a.parSum += s.tempoParado; a.parN += 1; }
        return a;
      },
      { total: 0, novos: 0, semContato: 0, visitaAgendada: 0, negociacao: 0, fechados: 0, valorNegociacao: 0, valorVendido: 0, respSum: 0, respN: 0, parSum: 0, parN: 0 },
    );
    const decididos = acc.fechados + perCorretor.reduce((s, c) => s + c.leads.filter((l) => l.etapa === "perdido").length, 0);
    return {
      ...acc,
      conversao: decididos > 0 ? (acc.fechados / decididos) * 100 : 0,
      tempoMedioResposta: acc.respN ? acc.respSum / acc.respN : null,
      tempoParado: acc.parN ? acc.parSum / acc.parN : null,
    };
  }, [perCorretor]);

  const loading = loadingLeads || loadingProf || !me;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Minha Equipe</h2>
        <p className="text-xs text-muted-foreground">
          {me?.isAdmin ? "Visão de todas as equipes de vendas." : "Acompanhe em tempo real o desempenho dos corretores sob sua gestão."}
        </p>
      </div>

      {/* KPIs da equipe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Total de leads" value={teamTotals.total} />
        <KpiCard icon={<Trophy className="h-4 w-4" />} label="Vendidos" value={teamTotals.fechados} tone="green" />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Vendido (R$)" value={formatBRL(teamTotals.valorVendido)} tone="green" />
        <KpiCard icon={<Handshake className="h-4 w-4" />} label="Em negociação (R$)" value={formatBRL(teamTotals.valorNegociacao)} tone="pink" />
        <KpiCard icon={<Sparkles className="h-4 w-4" />} label="Novos" value={teamTotals.novos} tone="blue" />
        <KpiCard icon={<PhoneOff className="h-4 w-4" />} label="Sem contato" value={teamTotals.semContato} tone="red" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Conversão" value={`${teamTotals.conversao.toFixed(0)}%`} tone="green" />
        <KpiCard icon={<Timer className="h-4 w-4" />} label="1º atendimento" value={fmtMin(teamTotals.tempoMedioResposta)} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}

      {!loading && perCorretor.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum corretor na sua equipe ainda.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {perCorretor.map((s) => (
          <Card key={s.corretor.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initials(s.corretor.nome)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.corretor.nome ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.total} leads</Badge>
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{s.conversao.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <MetricTile onClick={() => setDrill({ stats: s, key: "total" })} icon={<Users className="h-3.5 w-3.5" />} label="Total" value={s.total} />
                <MetricTile onClick={() => setDrill({ stats: s, key: "novos" })} icon={<Sparkles className="h-3.5 w-3.5" />} label="Novos" value={s.novos} tone="blue" />
                <MetricTile onClick={() => setDrill({ stats: s, key: "sem_contato" })} icon={<PhoneOff className="h-3.5 w-3.5" />} label="Sem contato" value={s.semContato} tone="red" />
                <MetricTile onClick={() => setDrill({ stats: s, key: "visita_agendada" })} icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Visita" value={s.visitaAgendada} tone="yellow" />
                <MetricTile onClick={() => setDrill({ stats: s, key: "negociacao" })} icon={<Handshake className="h-3.5 w-3.5" />} label="Negociação" value={s.negociacao} tone="pink" />
                <MetricTile onClick={() => setDrill({ stats: s, key: "fechados" })} icon={<Trophy className="h-3.5 w-3.5" />} label="Fechados" value={s.fechados} tone="green" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                <InfoRow icon={<Timer className="h-3 w-3" />} label="1º atendimento" value={fmtMin(s.tempoMedioResposta)} />
                <InfoRow icon={<Hourglass className="h-3 w-3" />} label="Sem movimentação" value={fmtDays(s.tempoParado)} tone={s.tempoParado != null && s.tempoParado > 5 ? "warn" : undefined} />
                <InfoRow icon={<Handshake className="h-3 w-3" />} label="Em negociação" value={formatBRL(s.valorNegociacao)} />
                <InfoRow icon={<DollarSign className="h-3 w-3" />} label="Vendido" value={formatBRL(s.valorVendido)} tone="ok" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drill-down sheet */}
      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {drill && (
            <>
              <SheetHeader>
                <SheetTitle>{METRIC_LABEL[drill.key]} — {drill.stats.corretor.nome ?? "—"}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {(() => {
                  const items = filterLeads(drill.stats.leads, drill.key);
                  if (items.length === 0) return <div className="text-sm text-muted-foreground text-center py-8">Nenhum lead nesta categoria.</div>;
                  return items.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setDetailId(l.id); }}
                      className="w-full text-left rounded-md border border-border/60 p-3 bg-background/60 hover:bg-muted/40 transition-colors flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.nome}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {l.tipo === "compra" ? "Compra" : "Locação"} · {formatBRL(l.valor != null ? Number(l.valor) : null)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ));
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <VendasLeadDetail
        leadId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        isAdmin={me?.isAdmin ?? false}
        onChanged={() => qc.invalidateQueries({ queryKey: ["equipe_leads"] })}
      />
    </div>
  );
}

type Tone = "blue" | "red" | "yellow" | "pink" | "green" | undefined;
const TONE_BG: Record<NonNullable<Tone>, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  yellow: "bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-500/20",
  pink: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
  green: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
};

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <Card className={`border ${tone ? TONE_BG[tone] : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">{icon}{label}</div>
        <div className="text-lg md:text-xl font-bold mt-1 leading-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ icon, label, value, tone, onClick }: { icon: React.ReactNode; label: string; value: number; tone?: Tone; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-2 text-left hover:brightness-110 active:scale-[0.98] transition-all ${tone ? TONE_BG[tone] : "border-border/60"}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">{icon}{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
    </button>
  );
}

function InfoRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  const cls = tone === "warn" ? "text-orange-600 dark:text-orange-400" : tone === "ok" ? "text-green-700 dark:text-green-400" : "";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
}
