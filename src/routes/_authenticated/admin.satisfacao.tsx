import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, Send, RefreshCcw, Clock, MessageSquare, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format, parseISO, isValid, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { enviarPesquisasSatisfacaoPendentes, expirarPesquisasSatisfacao } from "@/lib/satisfacao.functions";

export const Route = createFileRoute("/_authenticated/admin/satisfacao")({
  head: () => ({ meta: [{ title: "Satisfação Pós-Venda — Admin" }] }),
  component: SatisfacaoPage,
});

type Stats = {
  periodo: { from: string; to: string };
  totais: { total: number; pendentes: number; enviadas: number; respondidas: number; sem_resposta: number; falhas: number };
  nota_media: number | null;
  distribuicao: Record<string, number>;
  taxa_resposta: number | null;
  respostas: Array<{ id: string; lead_id: string; lead_nome: string; corretor_nome: string | null; nota: number; comentario: string | null; respondida_em: string }>;
};

function fmt(s: string | null | undefined): string {
  if (!s) return "—";
  try { const d = parseISO(s); return isValid(d) ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"; } catch { return "—"; }
}

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-gold text-gold" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function SatisfacaoPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const stats = useQuery({
    queryKey: ["satisfacao-stats", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_satisfacao_stats", {
        _from: new Date(from + "T00:00:00").toISOString(),
        _to: new Date(to + "T23:59:59").toISOString(),
      });
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  const enviar = useServerFn(enviarPesquisasSatisfacaoPendentes);
  const expirar = useServerFn(expirarPesquisasSatisfacao);

  const enviarMut = useMutation({
    mutationFn: async () => enviar({ data: undefined as never }),
    onSuccess: (r) => {
      toast.success(`${r.enviadas} pesquisas enviadas, ${r.falhas} falhas.`);
      qc.invalidateQueries({ queryKey: ["satisfacao-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const expirarMut = useMutation({
    mutationFn: async () => expirar({ data: undefined as never }),
    onSuccess: (r) => {
      toast.success(`${r.expiradas} pesquisas expiradas.`);
      qc.invalidateQueries({ queryKey: ["satisfacao-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-5 w-5 text-gold" /> Pesquisa de Satisfação Pós-Venda
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Pesquisas criadas automaticamente quando um lead vai para "Fechado". Envie via WhatsApp e veja as respostas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => expirarMut.mutate()} disabled={expirarMut.isPending}>
            {expirarMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Clock className="h-3.5 w-3.5 mr-1.5" />}
            Expirar antigas
          </Button>
          <Button size="sm" onClick={() => enviarMut.mutate()} disabled={enviarMut.isPending}>
            {enviarMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Enviar pendentes
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6 grid md:grid-cols-[auto,auto,1fr] gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => stats.refetch()} disabled={stats.isFetching}>
              <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${stats.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
          {(stats.error as Error).message}
        </div>
      )}

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Nota média" value={s.nota_media != null ? s.nota_media.toFixed(2) : "—"} icon={<Star className="h-4 w-4 text-gold" />} />
            <StatCard label="Taxa de resposta" value={s.taxa_resposta != null ? `${s.taxa_resposta}%` : "—"} />
            <StatCard label="Total" value={s.totais.total.toString()} />
            <StatCard label="Pendentes" value={s.totais.pendentes.toString()} hint="aguardando envio" />
            <StatCard label="Enviadas" value={s.totais.enviadas.toString()} hint="aguardando resposta" />
            <StatCard label="Respondidas" value={s.totais.respondidas.toString()} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Distribuição das notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const qtd = s.distribuicao?.[n.toString()] ?? 0;
                const respondidas = s.totais.respondidas || 1;
                const pct = Math.round((qtd / respondidas) * 100);
                return (
                  <div key={n} className="flex items-center gap-3 text-sm">
                    <div className="w-20 flex items-center gap-1"><StarRow n={n} /></div>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-20 text-right text-xs tabular-nums text-muted-foreground">{qtd} ({pct}%)</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Respostas recentes
                <Badge variant="secondary" className="ml-1">{s.respostas.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.respostas.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">Nenhuma resposta no período.</div>
              ) : s.respostas.map((r) => (
                <div key={r.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <StarRow n={r.nota} />
                      <span className="font-medium text-sm">{r.lead_nome}</span>
                      {r.corretor_nome && <span className="text-xs text-muted-foreground">· {r.corretor_nome}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(r.respondida_em)}</span>
                  </div>
                  {r.comentario && (
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap pl-1 border-l-2 border-muted ml-1">
                      "{r.comentario}"
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {s.totais.falhas > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {s.totais.falhas} pesquisa(s) com falha de envio após 3 tentativas.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
