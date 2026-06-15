import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canalNome, type LeadRow } from "@/lib/lead-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, BadgeCheck, XCircle, HelpCircle, Users, Car, MapPin, Trash2, MessageCircle } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { CreateLeadDialog } from "@/components/create-lead-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type DadosCorretor = {
  ja_corretor?: string | null;
  creci_ativo?: string | null;
  numero_creci?: string | null;
  disponibilidade_barra?: string | null;
  disponibilidade_recreio?: string | null;
  disponibilidade_belford?: string | null;
  disponibilidade_mesquita?: string | null;
  disponibilidade_video?: string | null;
  possui_veiculo?: string | null;
};

type CorretorLead = LeadRow & { dados_corretor: DadosCorretor | null };
type Responsavel = { id: string; nome: string; canal: string };

export const Route = createFileRoute("/_authenticated/corretores")({
  head: () => ({ meta: [{ title: "Captação de Corretores — Sistema NEXUS" }] }),
  validateSearch: (search: Record<string, unknown>): { exec?: string } => ({
    exec: typeof search.exec === "string" ? search.exec : undefined,
  }),
  component: CorretoresPage,
});

function isYes(v?: string | null) {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.startsWith("sim") || s.startsWith("yes") || s === "true";
}

function YesNo({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  if (isYes(value)) {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" />{value}</span>;
  }
  const s = value.toLowerCase();
  if (s.startsWith("não") || s.startsWith("nao") || s.startsWith("no") || s === "false") {
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />{value}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><HelpCircle className="h-3.5 w-3.5" />{value}</span>;
}

function CorretoresPage() {
  const { exec } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [leads, setLeads] = useState<CorretorLead[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [q, setQ] = useState("");
  const [respFilter, setRespFilter] = useState<string>(exec ?? "todos");
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      setIsAdmin(data?.role === "admin");
    });
  }, []);

  async function load() {
    const [{ data: ls }, { data: rs }] = await Promise.all([
      supabase.from("leads").select("*").eq("etapa", "fechado").order("fechado_em", { ascending: false, nullsFirst: false }),
      supabase.from("responsaveis").select("id, nome, canal").order("nome"),
    ]);
    setLeads((ls as CorretorLead[]) ?? []);
    setResponsaveis((rs as Responsavel[]) ?? []);
    setSelected(new Set());
  }

  useEffect(() => { load(); }, []);

  const respMap = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r.nome])), [responsaveis]);

  const scoped = useMemo(() => {
    if (!isAdmin) return leads; // RLS already filtered
    if (respFilter === "todos") return leads;
    return leads.filter((l) => l.responsavel_id === respFilter);
  }, [leads, respFilter, isAdmin]);

  const filtered = scoped.filter((l) =>
    !q || l.nome.toLowerCase().includes(q.toLowerCase()) || l.telefone.includes(q));

  const metrics = useMemo(() => {
    const total = scoped.length;
    const creciAtivo = scoped.filter((l) => isYes(l.dados_corretor?.creci_ativo)).length;
    const dispRegiao = scoped.filter((l) => {
      const d = l.dados_corretor;
      return isYes(d?.disponibilidade_barra) || isYes(d?.disponibilidade_recreio) || isYes(d?.disponibilidade_belford) || isYes(d?.disponibilidade_mesquita);
    }).length;
    const veiculo = scoped.filter((l) => isYes(l.dados_corretor?.possui_veiculo)).length;
    return { total, creciAtivo, dispRegiao, veiculo };
  }, [scoped]);

  const countsByResp = useMemo(() => {
    const m: Record<string, number> = { todos: leads.length };
    responsaveis.forEach((r) => { m[r.id] = leads.filter((l) => l.responsavel_id === r.id).length; });
    return m;
  }, [leads, responsaveis]);

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }
  async function deleteSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} excluído(s)`);
    load();
  }

  function exportCsv() {
    const headers = [
      "Nome", "Telefone", "Email", "Executivo", "Já corretor", "CRECI ativo", "Nº CRECI",
      "Disp. Barra", "Disp. Recreio", "Disp. Belford", "Disp. Mesquita/Niló.", "Disp. Video", "Possui veículo", "Canal", "Criado em",
    ];
    const rows = filtered.map((l) => {
      const d = l.dados_corretor ?? {};
      return [
        l.nome, l.telefone, l.email ?? "",
        l.responsavel_id ? (respMap[l.responsavel_id] ?? "") : "",
        d.ja_corretor ?? "", d.creci_ativo ?? "", d.numero_creci ?? "",
        d.disponibilidade_barra ?? "", d.disponibilidade_recreio ?? "", d.disponibilidade_belford ?? "", d.disponibilidade_mesquita ?? "",
        d.disponibilidade_video ?? "", d.possui_veiculo ?? "",
        canalNome(l.canal), format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `corretores-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const respLabel = respFilter === "todos" ? "Todos" : (respMap[respFilter] ?? "—");
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Corretores do Time</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtered.length} de {scoped.length} corretores contratados {isAdmin && respFilter !== "todos" && `de ${respLabel}`}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <Input placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 md:w-64 h-11" />
          <CreateLeadDialog mode="corretor" isAdmin={isAdmin} responsaveis={responsaveis} onCreated={load} />
          {isAdmin && (
            <Button variant="outline" onClick={exportCsv} className="h-11"><Download className="h-4 w-4" /> Exportar</Button>
          )}
        </div>
      </header>

      {/* Filtro por executivo — admin only */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button variant={respFilter === "todos" ? "default" : "outline"} size="sm" onClick={() => setRespFilter("todos")} className="h-11">
            Todos <span className="ml-1.5 text-xs opacity-70">({countsByResp["todos"] ?? 0})</span>
          </Button>
          {responsaveis.map((r) => (
            <Button key={r.id} variant={respFilter === r.id ? "default" : "outline"} size="sm" onClick={() => setRespFilter(r.id)} className="h-11">
              <span className="text-[10px] font-bold text-gold mr-1">EXEC.</span>{r.nome} <span className="ml-1.5 text-xs opacity-70">({countsByResp[r.id] ?? 0})</span>
            </Button>
          ))}
        </div>
      )}

      {/* Bulk delete bar */}
      {isAdmin && selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /> Excluir selecionados</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selected.size} item(s)?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Total candidatos" value={metrics.total} />
        <MetricCard icon={BadgeCheck} label="CRECI ativo" value={metrics.creciAtivo} />
        <MetricCard icon={MapPin} label="Disp. na região" value={metrics.dispRegiao} />
        <MetricCard icon={Car} label="Possui veículo" value={metrics.veiculo} />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((l) => {
          const d = l.dados_corretor ?? {};
          return (
            <Card key={l.id} className="active:bg-muted/40">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  {isAdmin && (
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} onClick={(e) => e.stopPropagation()} className="mt-1" />
                  )}
                  <div className="flex-1 cursor-pointer" onClick={() => setOpenLead(l.id)}>
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{l.nome}</div>
                        <div className="text-xs text-muted-foreground">{l.telefone}</div>
                        {l.email && <div className="text-xs text-muted-foreground truncate">{l.email}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">{l.responsavel_id ? respMap[l.responsavel_id] : "—"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-border mt-2">
                      <div className="text-xs"><span className="text-muted-foreground">CRECI: </span><YesNo value={d.creci_ativo} /></div>
                      <div className="text-xs"><span className="text-muted-foreground">Nº: </span>{d.numero_creci ?? "—"}</div>
                      <div className="text-xs col-span-2"><span className="text-muted-foreground">Veículo: </span><YesNo value={d.possui_veiculo} /></div>
                    </div>
                  </div>
                </div>
                {l.telefone && (
                  <a
                    href={`https://wa.me/${l.telefone.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">Nenhuma captação encontrada.</div>
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Executivo</TableHead>
              <TableHead>Já corretor</TableHead>
              <TableHead>CRECI</TableHead>
              <TableHead>Nº CRECI</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => {
              const d = l.dados_corretor ?? {};
              return (
                <TableRow key={l.id} className="hover:bg-muted/40">
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium cursor-pointer" onClick={() => setOpenLead(l.id)}>
                    <div className="flex items-center gap-2">
                      <span>{l.nome}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">CORRETOR</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm cursor-pointer" onClick={() => setOpenLead(l.id)}>
                    <div>{l.telefone}</div>
                    {l.email && <div className="text-muted-foreground text-xs">{l.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{l.responsavel_id ? <span><span className="text-[10px] font-bold text-gold mr-1">EXEC.</span>{respMap[l.responsavel_id]}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><YesNo value={d.ja_corretor} /></TableCell>
                  <TableCell><YesNo value={d.creci_ativo} /></TableCell>
                  <TableCell className="text-sm">{d.numero_creci ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><YesNo value={d.possui_veiculo} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {l.telefone && (
                      <a
                        href={`https://wa.me/${l.telefone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-8">
                Nenhuma captação encontrada.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LeadDetailSheet leadId={openLead} onClose={() => setOpenLead(null)} onUpdated={load} backLabel="Voltar aos Corretores" />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
