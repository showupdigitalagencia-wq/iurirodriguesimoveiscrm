import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Target, Save, Loader2, ChevronLeft, ChevronRight, Lock, Plus, Minus, Crown } from "lucide-react";
import { toast } from "sonner";
import { salvarMetaCorretor } from "@/lib/metas.functions";

export const Route = createFileRoute("/_authenticated/vendas/metas")({
  head: () => ({ meta: [{ title: "Metas Mensais — Vendas" }] }),
  component: MetasPage,
});

type Corretor = {
  id: string; nome: string; equipe: string | null;
  is_executivo?: boolean;
  meta: { definida: boolean; vendas: number; locacoes: number; receita: number; leads_atendidos: number };
  realizado: { vendas: number; locacoes: number; receita: number; leads_atendidos: number };
};
type Lista = { ano: number; mes: number; corretores: Corretor[] };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (real: number, meta: number) => meta > 0 ? Math.min(100, Math.round((real / meta) * 100)) : 0;

function MetasPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  // Detecta papel — somente admin gerencia (executivos perderam o acesso de gestão)
  const role = useQuery({
    queryKey: ["meu-papel-metas"],
    queryFn: async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id ?? "";
      const isAdminRes = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as never });
      return {
        uid: uid || null,
        isAdmin: isAdminRes.data === true,
      };
    },
  });

  const isManager = role.data?.isAdmin === true;

  // Lista (para admin/exec)
  const lista = useQuery({
    queryKey: ["metas-lista", ano, mes],
    enabled: !!isManager,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_metas_progresso_lista", { _ano: ano, _mes: mes });
      if (error) throw error;
      return data as unknown as Lista;
    },
  });

  // Meta individual (corretor)
  const minhaMeta = useQuery({
    queryKey: ["minha-meta", ano, mes, role.data?.uid],
    enabled: !isManager && !!role.data?.uid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_meta_progresso", {
        _corretor_id: role.data!.uid!, _ano: ano, _mes: mes,
      });
      if (error) throw error;
      return data as unknown as { meta: Corretor["meta"]; realizado: Corretor["realizado"] };
    },
  });

  const mesPassado = ano * 100 + mes < now.getFullYear() * 100 + (now.getMonth() + 1);

  const goPrev = () => {
    if (mes === 1) { setMes(12); setAno(ano - 1); } else setMes(mes - 1);
  };
  const goNext = () => {
    if (mes === 12) { setMes(1); setAno(ano + 1); } else setMes(mes + 1);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 text-gold" /> Metas Mensais
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {isManager ? "Defina e acompanhe as metas da equipe." : "Acompanhe sua meta do mês."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="px-3 py-1.5 border rounded-md text-sm font-medium min-w-[160px] text-center">
            {MESES[mes - 1]} / {ano}
            {mesPassado && <Lock className="h-3 w-3 inline ml-2 text-muted-foreground" />}
          </div>
          <Button size="icon" variant="outline" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      {mesPassado && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          Mês passado — visualização somente leitura. Não é possível editar metas de meses encerrados.
        </div>
      )}

      {isManager && lista.data && (
        <div className="space-y-3">
          {lista.data.corretores.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
              Nenhum corretor no seu escopo.
            </div>
          )}
          {lista.data.corretores.map((c) => (
            <LinhaCorretor
              key={c.id}
              corretor={c}
              ano={ano} mes={mes}
              readonly={mesPassado}
              onSaved={() => qc.invalidateQueries({ queryKey: ["metas-lista"] })}
            />
          ))}
        </div>
      )}

      {!isManager && minhaMeta.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Meu progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!minhaMeta.data.meta.definida && (
              <div className="text-sm text-muted-foreground p-3 border rounded-md">
                Nenhuma meta definida para você neste mês. Solicite ao seu executivo ou admin.
              </div>
            )}
            <ProgressoBlock realizado={minhaMeta.data.realizado} meta={minhaMeta.data.meta} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaCorretor({ corretor, ano, mes, readonly, onSaved }: {
  corretor: Corretor; ano: number; mes: number; readonly: boolean; onSaved: () => void;
}) {
  const [vendas, setVendas] = useState(corretor.meta.vendas);
  const [locacoes, setLocacoes] = useState(corretor.meta.locacoes);
  const [receita, setReceita] = useState(corretor.meta.receita);
  const [leadsAt, setLeadsAt] = useState(corretor.meta.leads_atendidos);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("metas_mensais").upsert({
        corretor_id: corretor.id, ano, mes,
        meta_vendas: vendas, meta_locacoes: locacoes,
        meta_receita: receita, meta_leads_atendidos: leadsAt,
      }, { onConflict: "corretor_id,ano,mes" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Meta de ${corretor.nome} atualizada.`); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-medium text-sm">{corretor.nome}</div>
            {corretor.equipe && <div className="text-xs text-muted-foreground">Equipe: {corretor.equipe}</div>}
          </div>
          {corretor.meta.definida ? (
            <Badge variant="outline" className="text-[10px]">Meta definida</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Sem meta</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CampoMeta label="Vendas (qtd)" value={vendas} onChange={setVendas} readonly={readonly} />
          <CampoMeta label="Locações (qtd)" value={locacoes} onChange={setLocacoes} readonly={readonly} />
          <CampoMeta label="Receita (R$)" value={receita} onChange={setReceita} readonly={readonly} step={1000} />
          <CampoMeta label="Leads atendidos" value={leadsAt} onChange={setLeadsAt} readonly={readonly} />
        </div>

        <ProgressoBlock realizado={corretor.realizado} meta={{ ...corretor.meta, vendas, locacoes, receita, leads_atendidos: leadsAt, definida: true }} />

        {!readonly && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar meta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampoMeta({ label, value, onChange, readonly, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; readonly: boolean; step?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number" min={0} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={readonly}
      />
    </div>
  );
}

function ProgressoBlock({ realizado, meta }: {
  realizado: Corretor["realizado"];
  meta: Corretor["meta"];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Barra label="Vendas" real={realizado.vendas} meta={meta.vendas} />
      <Barra label="Locações" real={realizado.locacoes} meta={meta.locacoes} />
      <Barra label="Receita" real={realizado.receita} meta={meta.receita} formatar={brl} />
      <Barra label="Atendidos" real={realizado.leads_atendidos} meta={meta.leads_atendidos} />
    </div>
  );
}

function Barra({ label, real, meta, formatar }: { label: string; real: number; meta: number; formatar?: (v: number) => string }) {
  const p = pct(real, meta);
  const fmt = formatar ?? ((v: number) => v.toLocaleString("pt-BR"));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{fmt(real)}/{fmt(meta)}</span>
      </div>
      <div className="h-1.5 rounded bg-muted overflow-hidden">
        <div className={`h-full ${p >= 100 ? "bg-green-500" : "bg-gold"}`} style={{ width: `${p}%` }} />
      </div>
      <div className="text-[10px] text-right text-muted-foreground tabular-nums">{p}%</div>
    </div>
  );
}
