import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEscalaMes, setPlantonista, removerPlantonista, listCorretoresElegiveis, getPlantonistaHoje } from "@/lib/plantao.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vendas/plantao")({
  component: PlantaoPage,
});

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlantaoPage() {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mes, setMes] = useState(today.getMonth() + 1);
  const qc = useQueryClient();

  const getEscala = useServerFn(getEscalaMes);
  const setP = useServerFn(setPlantonista);
  const delP = useServerFn(removerPlantonista);
  const listE = useServerFn(listCorretoresElegiveis);
  const getHoje = useServerFn(getPlantonistaHoje);

  // Checa role do usuário p/ habilitar edição
  const { data: meRole } = useQuery({
    queryKey: ["me-role-plantao"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id;
      if (!uid) return { canEdit: false, isAdmin: false, isExec: false, uid: null as string | null };
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
      const { data: isExec } = await supabase.rpc("current_user_is_executivo");
      return { canEdit: isAdmin || !!isExec, isAdmin, isExec: !!isExec, uid };
    },
  });
  const canEdit = !!meRole?.canEdit;
  const isAdmin = !!meRole?.isAdmin;
  const meUid = meRole?.uid ?? null;

  const escalaQ = useQuery({
    queryKey: ["plantao-escala", ano, mes],
    queryFn: () => getEscala({ data: { ano, mes } }),
  });
  const elegQ = useQuery({
    queryKey: ["plantao-elegiveis"],
    queryFn: () => listE(),
    enabled: canEdit,
  });
  const hojeQ = useQuery({
    queryKey: ["plantao-hoje"],
    queryFn: () => getHoje(),
    refetchInterval: 60_000,
  });

  const setMut = useMutation({
    mutationFn: (vars: { data: string; corretor_id: string }) => setP({ data: vars }),
    onSuccess: () => {
      toast.success("Plantonista atualizado");
      qc.invalidateQueries({ queryKey: ["plantao-escala"] });
      qc.invalidateQueries({ queryKey: ["plantao-hoje"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const delMut = useMutation({
    mutationFn: (data: string) => delP({ data: { data } }),
    onSuccess: () => {
      toast.success("Plantonista removido");
      qc.invalidateQueries({ queryKey: ["plantao-escala"] });
      qc.invalidateQueries({ queryKey: ["plantao-hoje"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const escalaByDia = new Map<string, { id: string; corretor_id: string; corretor_nome: string | null }>();
  for (const r of escalaQ.data?.items ?? []) escalaByDia.set(r.data, r);

  // Mapa de flags do plantonista (admin/exec) — vem do listCorretoresElegiveis
  const flagsById = new Map<string, { is_admin: boolean; is_exec: boolean }>();
  for (const c of elegQ.data?.items ?? []) flagsById.set(c.id, { is_admin: !!c.is_admin, is_exec: !!c.is_exec });
  // Se NÃO sou admin, não posso mexer no slot quando o ocupante é outro exec ou um admin
  function isCellLockedForMe(corretorId: string | undefined | null): boolean {
    if (!corretorId) return false;
    if (isAdmin) return false;
    if (meUid && corretorId === meUid) return false; // pode mexer em si mesmo
    const f = flagsById.get(corretorId);
    return !!(f?.is_admin || f?.is_exec);
  }

  // Monta grade do mês
  const firstDay = new Date(ano, mes - 1, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(ano, mes - 1, d));
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const next = new Date(ano, mes - 1 + delta, 1);
    setAno(next.getFullYear());
    setMes(next.getMonth() + 1);
  }

  const todayStr = ymd(today);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Plantão de Vendas</CardTitle>
          <div className="text-sm text-muted-foreground">
            {hojeQ.data?.corretor_nome
              ? <>Hoje: <strong className="text-foreground">{hojeQ.data.corretor_nome}</strong></>
              : <span className="text-amber-600">Hoje sem plantonista escalado</span>}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Leads de ZAP Imóveis, OLX, Site e WhatsApp são distribuídos automaticamente para o plantonista do dia.
            Leads de Facebook com região fixa (Barra, Recreio, Belford Roxo, Nilópolis, Mesquita) continuam indo para a responsável da região.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">
              {firstDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {!canEdit && <span className="text-xs text-muted-foreground">Somente leitura</span>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-muted-foreground mb-1">
            {WD.map((w) => <div key={w} className="text-center py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="aspect-[3/2] md:aspect-[2/1] rounded bg-muted/30" />;
              const ds = ymd(d);
              const isPast = ds < todayStr;
              const isToday = ds === todayStr;
              const ent = escalaByDia.get(ds);
              const locked = isCellLockedForMe(ent?.corretor_id);
              const lockTitle = locked
                ? (flagsById.get(ent!.corretor_id)?.is_admin
                    ? "Apenas Admin pode alterar a escala de outro Admin"
                    : "Apenas Admin pode alterar a escala de outro Executivo")
                : undefined;
              return (
                <div
                  key={i}
                  className={`relative aspect-[3/2] md:aspect-[2/1] rounded border p-1 flex flex-col text-xs ${isToday ? "border-gold bg-gold/5" : "border-border"} ${isPast ? "opacity-60" : ""}`}
                  title={lockTitle}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{d.getDate()}</span>
                    {ent && canEdit && !isPast && !locked && (
                      <button onClick={() => delMut.mutate(ds)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {canEdit && !isPast && !locked ? (
                    <Select
                      value={ent?.corretor_id ?? ""}
                      onValueChange={(v) => setMut.mutate({ data: ds, corretor_id: v })}
                    >
                      <SelectTrigger className="h-7 text-[11px] mt-auto truncate">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {(elegQ.data?.items ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-auto truncate text-[11px] text-muted-foreground">{ent?.corretor_nome ?? "—"}</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// evita warning de import não usado em projetos com noUnusedLocals
void useSuspenseQuery;
