import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listarMinhasConquistas, type ConquistaItem } from "@/lib/conquistas.functions";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({ meta: [{ title: "Minhas Conquistas — Sistema NEXUS" }] }),
  component: ConquistasPage,
});

const CATEGORIA_LABEL: Record<string, string> = {
  vendas: "Vendas",
  locacao: "Locação",
  atividade: "Atividade",
  atendimento: "Atendimento",
  meta: "Metas",
  captacao: "Captação",
};

function ConquistasPage() {
  const fetcher = useServerFn(listarMinhasConquistas);
  const { data, isLoading, error } = useQuery({
    queryKey: ["conquistas", "me"],
    queryFn: () => fetcher({ data: undefined as never }),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const desbloqueadas = items.filter((i) => i.desbloqueada_em);
  const grupos = items.reduce<Record<string, ConquistaItem[]>>((acc, i) => {
    (acc[i.categoria] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-semibold">Minhas Conquistas</h1>
          <p className="text-sm text-muted-foreground">
            {desbloqueadas.length} de {items.length} desbloqueadas
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {error && <p className="text-sm text-destructive">Erro ao carregar conquistas</p>}

      {Object.entries(grupos).map(([cat, lista]) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORIA_LABEL[cat] ?? cat}
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((c) => {
              const desbloqueada = !!c.desbloqueada_em;
              const pct = Math.min(100, Math.round((c.progresso / Math.max(1, c.meta_valor)) * 100));
              return (
                <Card
                  key={c.id}
                  className={`p-4 transition ${desbloqueada ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10" : "opacity-80"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-3xl ${desbloqueada ? "" : "grayscale opacity-50"}`}>{c.icone}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{c.nome}</h3>
                        {desbloqueada && <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Desbloqueada</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>
                      <div className="mt-3 space-y-1">
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{Math.min(c.progresso, c.meta_valor)} / {c.meta_valor}</span>
                          {desbloqueada && c.desbloqueada_em && (
                            <span>{new Date(c.desbloqueada_em).toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
