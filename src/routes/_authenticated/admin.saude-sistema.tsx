import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, BellRing, Webhook, CalendarClock, AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/saude-sistema")({
  head: () => ({ meta: [{ title: "Saúde do Sistema — Admin" }] }),
  component: SaudeSistemaPage,
});

type PushBlock = { total: number; ok: number; pct: number | null };
type WebhookRow = { fonte: string; ultima: string | null; erros_24h: number };
type PlantaoDia = { data: string; corretor_id: string | null; sem_escala: boolean };
type Saude = {
  gerado_em: string;
  push: { "24h": PushBlock; "7d": PushBlock };
  webhooks: WebhookRow[];
  plantao: { dias: PlantaoDia[]; dias_vazios: number };
};

const FONTE_LABEL: Record<string, string> = {
  zap_imoveis: "ZAP Imóveis",
  olx: "OLX",
  site: "Site",
  whatsapp_empresa: "WhatsApp Empresa",
  facebook: "Facebook",
};

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  try {
    const d = parseISO(s);
    if (!isValid(d)) return "—";
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch { return "—"; }
}

function fmtData(s: string): string {
  try {
    const d = parseISO(s);
    return format(d, "EEE dd/MM", { locale: ptBR });
  } catch { return s; }
}

function SaudeSistemaPage() {
  const q = useQuery({
    queryKey: ["saude-sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saude_sistema");
      if (error) throw error;
      return data as unknown as Saude;
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-gold" /> Saúde do Sistema
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Push, webhooks e plantão — atualizado ao abrir a página.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {q.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
          Erro: {(q.error as Error).message}
        </div>
      )}

      {q.isLoading && <div className="text-sm text-muted-foreground animate-pulse">Carregando...</div>}

      {q.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Push */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="h-4 w-4 text-gold" /> Notificações Push
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PushStat label="Últimas 24h" block={q.data.push["24h"]} />
              <PushStat label="Últimos 7 dias" block={q.data.push["7d"]} />
            </CardContent>
          </Card>

          {/* Webhooks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Webhook className="h-4 w-4 text-gold" /> Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {q.data.webhooks.map((w) => {
                  const stale = !w.ultima ||
                    (Date.now() - new Date(w.ultima).getTime()) > 24 * 60 * 60 * 1000;
                  return (
                    <div key={w.fonte} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{FONTE_LABEL[w.fonte] ?? w.fonte}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Última: {fmtDateTime(w.ultima)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {w.erros_24h > 0 && (
                          <Badge variant="destructive" className="text-[10px]">{w.erros_24h} erro{w.erros_24h > 1 ? "s" : ""}</Badge>
                        )}
                        {stale ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px]">Sem dados 24h</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">OK</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Plantão */}
          <Card className={q.data.plantao.dias_vazios > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-gold" /> Plantão (próximos 7 dias)
                {q.data.plantao.dias_vazios > 0 && (
                  <Badge variant="destructive" className="ml-auto text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {q.data.plantao.dias_vazios} sem escala
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {q.data.plantao.dias.map((d) => (
                  <div
                    key={d.data}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm ${
                      d.sem_escala
                        ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                        : "border-border"
                    }`}
                  >
                    <span>{fmtData(d.data)}</span>
                    {d.sem_escala ? (
                      <span className="flex items-center gap-1 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" /> Sem plantonista
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Escalado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {q.data && (
        <p className="text-[11px] text-muted-foreground">
          Última atualização: {fmtDateTime(q.data.gerado_em)}
        </p>
      )}
    </div>
  );
}

function PushStat({ label, block }: { label: string; block: PushBlock }) {
  const pct = block.pct;
  const color = pct === null ? "text-muted-foreground" : pct >= 95 ? "text-emerald-500" : pct >= 80 ? "text-amber-500" : "text-red-500";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-3xl font-bold ${color}`}>{pct === null ? "—" : `${pct}%`}</span>
        <span className="text-xs text-muted-foreground">{block.ok}/{block.total} entregues</span>
      </div>
    </div>
  );
}
