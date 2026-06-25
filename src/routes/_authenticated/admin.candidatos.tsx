import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listCandidatos, getCandidatoDocUrls, salvarCandidatoNoDrive, excluirCandidato, confirmarRecebimentoCandidato, type CandidatoRow } from "@/lib/candidatos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ExternalLink, FolderUp, FileText, Link2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/candidatos")({
  head: () => ({ meta: [{ title: "Candidatos — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.rpc("can_view_candidatos");
    if (data !== true) throw redirect({ to: "/admin" });
  },
  component: CandidatosPage,
});

const REGIAO_LABEL: Record<string, string> = {
  barra_da_tijuca: "Barra da Tijuca", recreio: "Recreio", jacarepagua: "Jacarepaguá",
  zona_sul: "Zona Sul", zona_norte: "Zona Norte", zona_oeste: "Zona Oeste", centro: "Centro",
  belford_roxo: "Belford Roxo", nilopolis: "Nilópolis", mesquita: "Mesquita", outras: "Outras",
};

const DOC_LABEL: Record<string, string> = {
  rg: "RG",
  cpf: "CPF",
  creci: "CRECI",
  comprovante: "Comprovante",
};

type DocUrls = { rg: string | null; cpf: string | null; creci: string | null; comprovante: string | null };

function CandidatosPage() {
  const list = useServerFn(listCandidatos);
  const [filter, setFilter] = useState<"pendente_revisao" | "recebido_confirmado" | "arquivado" | "todos">("pendente_revisao");
  const [rows, setRows] = useState<CandidatoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setLoading(true);
    list({ data: { status: filter } })
      .then((r) => setRows(r.candidatos))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [list, filter]);

  useEffect(() => { reload(); }, [reload]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg md:text-xl font-bold">Candidatos a Corretor</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Documentação recebida via /cadastro</p>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as never)}>
          <TabsList>
            <TabsTrigger value="pendente_revisao">Pendentes</TabsTrigger>
            <TabsTrigger value="recebido_confirmado">Recebidos</TabsTrigger>
            <TabsTrigger value="arquivado">Arquivados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <section className="space-y-3" aria-label="Documentos recebidos">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Documentos recebidos</h3>
            <p className="text-xs text-muted-foreground">Cada candidato aparece com RG, CPF, CRECI e comprovante identificados por tipo.</p>
          </div>
          {!loading && rows.length > 0 && <Badge variant="secondary">{rows.length} lead{rows.length > 1 ? "s" : ""}</Badge>}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum candidato encontrado.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((c) => (
              <CandidatoCard
                key={c.id}
                candidato={c}
                expanded={expanded.has(c.id)}
                onToggle={() => toggle(c.id)}
                onChanged={reload}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CandidatoCard({ candidato: c, expanded, onToggle, onChanged }: { candidato: CandidatoRow; expanded: boolean; onToggle: () => void; onChanged: () => void }) {
  const getUrls = useServerFn(getCandidatoDocUrls);
  const salvarDrive = useServerFn(salvarCandidatoNoDrive);
  const excluir = useServerFn(excluirCandidato);
  const confirmar = useServerFn(confirmarRecebimentoCandidato);
  const [urls, setUrls] = useState<DocUrls | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!expanded || urls) return;
    setLoadingDocs(true);
    getUrls({ data: { candidatoId: c.id } })
      .then(setUrls)
      .catch(() => setUrls(null))
      .finally(() => setLoadingDocs(false));
  }, [expanded, urls, getUrls, c.id]);

  async function handleSalvarDrive() {
    setSaving(true);
    try {
      await salvarDrive({ data: { candidatoId: c.id } });
      toast.success("Documentos salvos no Google Drive e candidato arquivado.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar no Drive");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir() {
    setDeleting(true);
    try {
      await excluir({ data: { candidatoId: c.id } });
      toast.success("Candidato e documentos excluídos.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmar() {
    setConfirming(true);
    try {
      await confirmar({ data: { candidatoId: c.id } });
      toast.success("Recebimento confirmado.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar");
    } finally {
      setConfirming(false);
    }
  }

  const slots = ["rg", "cpf", "creci", "comprovante"] as const;
  const recebidos = urls ? slots.filter((s) => urls[s]).length : 0;

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/30 transition">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <div className="min-w-0">
              <div className="font-semibold truncate">{c.nome}</div>
              <div className="text-xs text-muted-foreground">
                {REGIAO_LABEL[c.regiao] ?? c.regiao} • {c.telefone}{c.creci ? ` • CRECI ${c.creci}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={c.status === "arquivado" ? "secondary" : "default"}>
              {c.status === "arquivado" ? "Arquivado" : "Pendente"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Enviado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t bg-muted/10 p-4 space-y-4">
          <div className="grid gap-2 rounded-md border bg-background/60 p-3 text-sm sm:grid-cols-2">
            <div><span className="text-muted-foreground">Candidato:</span> {c.nome}</div>
            <div><span className="text-muted-foreground">Enviado em:</span> {new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
            <div><span className="text-muted-foreground">CPF:</span> {c.cpf}</div>
            <div><span className="text-muted-foreground">WhatsApp:</span> {c.telefone}</div>
            {c.email && <div className="sm:col-span-2"><span className="text-muted-foreground">E-mail:</span> {c.email}</div>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Documentos anexados</div>
              {urls && <Badge variant="outline">{recebidos} de {slots.length} recebidos</Badge>}
            </div>

            {loadingDocs && !urls ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos...
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {slots.map((slot) => {
                  const u = urls?.[slot] ?? null;
                  const recebido = !!u;
                  return (
                    <div key={slot} className={`flex items-center gap-3 rounded-md border p-3 text-sm ${recebido ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed border-destructive/40 bg-destructive/5"}`}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">
                          {DOC_LABEL[slot]}
                          {recebido
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{recebido ? "Documento recebido" : "Documento faltando"}</div>
                      </div>
                      {recebido ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={u!} target="_blank" rel="noreferrer">
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <Badge variant="secondary">Faltando</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {c.lead_id && (
              <Link to="/leads/$leadId" params={{ leadId: c.lead_id }} className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
                <Link2 className="h-4 w-4" /> Ver card no pipeline
              </Link>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {c.status !== "arquivado" && (
                <Button onClick={handleSalvarDrive} disabled={saving} className="bg-gold text-black hover:bg-gold/90">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><FolderUp className="h-4 w-4 mr-2" /> Salvar no Google Drive</>}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir candidato</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este candidato e seus documentos? Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
