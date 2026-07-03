import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChaveActions, useAtrasoHoras } from "@/components/admin/ChaveActions";
import { Key, KeyRound, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/chaves")({
  validateSearch: (s: Record<string, unknown>) => ({ open: typeof s.open === "string" ? s.open : undefined }),
  component: ChavesPage,
});

type Row = {
  id: string;
  codigo: string | null;
  tipo: string;
  rua: string;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  chave_com_id: string | null;
  chave_retirada_em: string | null;
  chave_foto_atual: string | null;
};

function horasFora(iso: string | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function ChavesPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const atrasoHoras = useAtrasoHoras();
  const [tab, setTab] = useState<"todas" | "disponiveis" | "em_uso" | "atrasadas">("todas");
  const [busca, setBusca] = useState("");
  // Tick a cada 60s só pra atualizar contadores de horas exibidos
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Deep link ?open=<imovel_id>: scroll + highlight
  useEffect(() => {
    if (!search.open) return;
    const id = search.open;
    const tries = [80, 300, 800, 1500];
    tries.forEach((delay) => setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-imovel-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-gold", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-gold", "ring-offset-2"), 3000);
      }
    }, delay));
  }, [search.open]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["chaves-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("id, codigo, tipo, rua, numero, bairro, cidade, chave_com_id, chave_retirada_em, chave_foto_atual")
        .order("chave_retirada_em", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.chave_com_id).filter(Boolean) as string[])),
    [rows],
  );
  const { data: nomes = {} } = useQuery({
    queryKey: ["chaves-nomes", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.nome ?? "—"; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("chaves-rastreio")
      .on("postgres_changes", { event: "*", schema: "public", table: "imoveis" }, () => {
        qc.invalidateQueries({ queryKey: ["chaves-rastreio"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chaves_log" }, () => {
        qc.invalidateQueries({ queryKey: ["chaves-rastreio"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = rows.filter((r) => {
    if (tab === "disponiveis" && r.chave_com_id) return false;
    if (tab === "em_uso" && !r.chave_com_id) return false;
    if (tab === "atrasadas" && (!r.chave_com_id || horasFora(r.chave_retirada_em) <= atrasoHoras)) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const nome = r.chave_com_id ? (nomes[r.chave_com_id] ?? "") : "";
    return [r.codigo, r.rua, r.bairro, r.cidade, nome].some((v) => (v ?? "").toString().toLowerCase().includes(q));
  });

  const totais = {
    todas: rows.length,
    disponiveis: rows.filter((r) => !r.chave_com_id).length,
    em_uso: rows.filter((r) => r.chave_com_id).length,
    atrasadas: rows.filter((r) => r.chave_com_id && horasFora(r.chave_retirada_em) > atrasoHoras).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="h-5 w-5 text-gold" /> Gestão de Chaves</h2>
          <p className="text-xs text-muted-foreground">Rastreio em tempo real. Alerta automático após {atrasoHoras}h fora.</p>
        </div>
        <Input className="w-full sm:w-72" placeholder="Buscar por código, endereço ou corretor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" value={totais.todas} icon={<Key className="h-4 w-4" />} />
        <KpiCard label="Disponíveis" value={totais.disponiveis} icon={<Key className="h-4 w-4 text-emerald-500" />} />
        <KpiCard label="Em uso" value={totais.em_uso} icon={<KeyRound className="h-4 w-4 text-blue-500" />} />
        <KpiCard label="Atrasadas" value={totais.atrasadas} icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} highlight={totais.atrasadas > 0} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="disponiveis">Disponíveis</TabsTrigger>
          <TabsTrigger value="em_uso">Em uso</TabsTrigger>
          <TabsTrigger value="atrasadas">Atrasadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma chave nesta visão.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const horas = horasFora(r.chave_retirada_em);
            const atrasada = r.chave_com_id && horas > atrasoHoras;
            return (
              <Card key={r.id} data-imovel-id={r.id} className={`transition-shadow ${atrasada ? "border-rose-500/40" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[11px] font-mono text-muted-foreground">{r.codigo ?? "—"}</div>
                      <div className="font-semibold capitalize">{r.tipo}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.rua}{r.numero ? `, ${r.numero}` : ""}{r.bairro ? ` — ${r.bairro}` : ""}
                      </div>
                    </div>
                  </div>
                  {r.chave_com_id ? (
                    <div className="text-xs">
                      <Badge className={atrasada ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"}>
                        Com {nomes[r.chave_com_id] ?? "—"} · {Math.floor(horas)}h
                      </Badge>
                    </div>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Disponível na imobiliária</Badge>
                  )}
                  <div className="pt-2 border-t">
                    <ChaveActions imovel={r} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-rose-500/40" : ""}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
