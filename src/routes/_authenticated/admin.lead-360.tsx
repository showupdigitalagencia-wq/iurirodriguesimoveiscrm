import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, Phone, FileText, Home, Users, Calendar, CalendarClock, ExternalLink, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/lead-360")({
  head: () => ({ meta: [{ title: "Lead 360° — Admin" }] }),
  component: Lead360Page,
});

type Result = {
  criterios: { telefone: string | null; cpf: string | null };
  gerado_em: string;
  captacao: Array<{ id: string; nome: string; telefone: string | null; email: string | null; regiao: string | null; etapa: string; origem: string | null; responsavel_nome: string | null; created_at: string; fechado_em: string | null; is_corretor: boolean | null; descredenciado_em: string | null }>;
  vendas: Array<{ id: string; nome: string; telefone: string | null; email: string | null; regiao: string | null; etapa: string; tipo: string | null; origem: string | null; valor: number | null; corretor_nome: string | null; created_at: string; fechado_em: string | null }>;
  financiamentos: Array<{ id: string; nome: string; status: string; imovel_endereco: string | null; imovel_valor: number | null; criado_por_nome: string | null; created_at: string }>;
  contratos: Array<{ id: string; nome: string; status: string; data_inicio: string | null; data_fim: string | null; valor_aluguel: number | null; imovel_id: string | null; created_at: string }>;
  candidatos: Array<{ id: string; nome: string; creci: string | null; regiao: string | null; status: string; responsavel_nome: string | null; created_at: string }>;
  visitas: Array<{ id: string; data_inicio: string; status: string; comparecimento: string | null; imovel_id: string | null; corretor_nome: string | null }>;
  reunioes: Array<{ id: string; titulo: string; data_inicio: string; tipo: string; status: string; criado_por_nome: string | null }>;
  totais: Record<string, number>;
};

function fmt(s: string | null | undefined): string {
  if (!s) return "—";
  try { const d = parseISO(s); return isValid(d) ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"; } catch { return "—"; }
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try { const d = parseISO(s); return isValid(d) ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"; } catch { return "—"; }
}
function brl(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function Lead360Page() {
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");

  const buscar = useMutation({
    mutationFn: async () => {
      const t = telefone.trim() || null;
      const c = cpf.trim() || null;
      if (!t && !c) throw new Error("Informe telefone ou CPF");
      const { data, error } = await supabase.rpc("buscar_lead_360", { _telefone: t, _cpf: c });
      if (error) throw error;
      return data as unknown as Result;
    },
  });

  const r = buscar.data;
  const total = r ? Object.values(r.totais).reduce((a, b) => a + (b || 0), 0) : 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-5 w-5 text-gold" /> Lead 360°
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Busca unificada por telefone ou CPF em todos os módulos. Toda consulta fica registrada na auditoria.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Critérios de busca</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid md:grid-cols-[1fr,1fr,auto] gap-3"
            onSubmit={(e) => { e.preventDefault(); buscar.mutate(); }}
          >
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Telefone (com ou sem máscara)</label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">CPF (apenas dígitos ou com pontos)</label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={buscar.isPending || (!telefone.trim() && !cpf.trim())} className="w-full md:w-auto">
                {buscar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                Buscar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {buscar.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
          {(buscar.error as Error).message}
        </div>
      )}

      {r && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Critérios:</span>
            {r.criterios.telefone && <Badge variant="outline">Tel: {r.criterios.telefone}</Badge>}
            {r.criterios.cpf && <Badge variant="outline">CPF: {r.criterios.cpf}</Badge>}
            <span className="ml-2">·</span>
            <span><b>{total}</b> registros encontrados em {Object.keys(r.totais).length} módulos</span>
          </div>

          {total === 0 && (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado para os critérios informados.
            </div>
          )}

          {r.captacao.length > 0 && (
            <Section icon={<Users className="h-4 w-4" />} title="Captação de Corretores" count={r.captacao.length}>
              {r.captacao.map((l) => (
                <Row
                  key={l.id}
                  title={l.nome}
                  subtitle={[l.telefone, l.email, l.regiao].filter(Boolean).join(" · ")}
                  badges={[l.etapa, l.is_corretor ? "É corretor" : null, l.descredenciado_em ? "Descredenciado" : null].filter(Boolean) as string[]}
                  meta={`Origem: ${l.origem || "—"} · Resp.: ${l.responsavel_nome || "—"} · Criado em ${fmt(l.created_at)}`}
                  to="/leads/$leadId"
                  params={{ leadId: l.id }}
                />
              ))}
            </Section>
          )}

          {r.vendas.length > 0 && (
            <Section icon={<Home className="h-4 w-4" />} title="Leads de Vendas" count={r.vendas.length}>
              {r.vendas.map((l) => (
                <Row
                  key={l.id}
                  title={l.nome}
                  subtitle={[l.telefone, l.email, l.regiao].filter(Boolean).join(" · ")}
                  badges={[l.etapa, l.tipo].filter(Boolean) as string[]}
                  meta={`Origem: ${l.origem || "—"} · Corretor: ${l.corretor_nome || "—"} · Valor: ${brl(l.valor)} · Criado em ${fmt(l.created_at)}`}
                  to="/vendas/leads"
                />
              ))}
            </Section>
          )}

          {r.financiamentos.length > 0 && (
            <Section icon={<FileText className="h-4 w-4" />} title="Financiamentos" count={r.financiamentos.length}>
              {r.financiamentos.map((f) => (
                <Row
                  key={f.id}
                  title={f.nome}
                  subtitle={f.imovel_endereco || "Imóvel não informado"}
                  badges={[f.status]}
                  meta={`Valor: ${brl(f.imovel_valor)} · Por: ${f.criado_por_nome || "—"} · Em ${fmt(f.created_at)}`}
                  to="/correspondente"
                />
              ))}
            </Section>
          )}

          {r.contratos.length > 0 && (
            <Section icon={<FileText className="h-4 w-4" />} title="Contratos de Locação" count={r.contratos.length}>
              {r.contratos.map((c) => (
                <Row
                  key={c.id}
                  title={c.nome}
                  subtitle={`Vigência: ${fmtDate(c.data_inicio)} → ${fmtDate(c.data_fim)}`}
                  badges={[c.status]}
                  meta={`Aluguel: ${brl(c.valor_aluguel)} · Criado em ${fmt(c.created_at)}`}
                  to="/admin/contratos"
                />
              ))}
            </Section>
          )}

          {r.candidatos.length > 0 && (
            <Section icon={<User className="h-4 w-4" />} title="Candidatos" count={r.candidatos.length}>
              {r.candidatos.map((c) => (
                <Row
                  key={c.id}
                  title={c.nome}
                  subtitle={[c.creci ? `CRECI ${c.creci}` : null, c.regiao].filter(Boolean).join(" · ")}
                  badges={[c.status]}
                  meta={`Resp.: ${c.responsavel_nome || "—"} · Criado em ${fmt(c.created_at)}`}
                  to="/admin/candidatos"
                />
              ))}
            </Section>
          )}

          {r.visitas.length > 0 && (
            <Section icon={<Calendar className="h-4 w-4" />} title="Visitas" count={r.visitas.length}>
              {r.visitas.map((v) => (
                <Row
                  key={v.id}
                  title={`Visita em ${fmt(v.data_inicio)}`}
                  subtitle={`Corretor: ${v.corretor_nome || "—"}`}
                  badges={[v.status, v.comparecimento || "pendente"]}
                  meta=""
                />
              ))}
            </Section>
          )}

          {r.reunioes.length > 0 && (
            <Section icon={<CalendarClock className="h-4 w-4" />} title="Reuniões" count={r.reunioes.length}>
              {r.reunioes.map((rr) => (
                <Row
                  key={rr.id}
                  title={rr.titulo}
                  subtitle={`Em ${fmt(rr.data_inicio)} · Por ${rr.criado_por_nome || "—"}`}
                  badges={[rr.tipo, rr.status]}
                  meta=""
                  to="/agenda"
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title} <Badge variant="secondary" className="ml-1">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ title, subtitle, badges, meta, to, params }: {
  title: string;
  subtitle?: string;
  badges?: string[];
  meta?: string;
  to?: string;
  params?: Record<string, string>;
}) {
  return (
    <div className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{title}</span>
          {badges?.filter(Boolean).map((b, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
          ))}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
        {meta && <div className="text-[11px] text-muted-foreground/80 mt-1">{meta}</div>}
      </div>
      {to && (
        <Link
          to={to as "/leads/$leadId"}
          params={params as { leadId: string }}
          className="shrink-0 text-xs text-gold inline-flex items-center gap-1 hover:underline"
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
