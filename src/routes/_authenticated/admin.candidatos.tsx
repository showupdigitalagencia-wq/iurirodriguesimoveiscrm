import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCandidatos, getCandidatoDocUrls, salvarCandidatoNoDrive, type CandidatoRow } from "@/lib/candidatos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ExternalLink, FolderUp, FileText, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/candidatos")({
  head: () => ({ meta: [{ title: "Candidatos — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: CandidatosPage,
});

const REGIAO_LABEL: Record<string, string> = {
  barra_da_tijuca: "Barra da Tijuca", recreio: "Recreio", jacarepagua: "Jacarepaguá",
  zona_sul: "Zona Sul", zona_norte: "Zona Norte", zona_oeste: "Zona Oeste", centro: "Centro",
  belford_roxo: "Belford Roxo", nilopolis: "Nilópolis", mesquita: "Mesquita", outras: "Outras",
};

function CandidatosPage() {
  const list = useServerFn(listCandidatos);
  const [filter, setFilter] = useState<"pendente_revisao" | "arquivado" | "todos">("pendente_revisao");
  const [rows, setRows] = useState<CandidatoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<CandidatoRow | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    list({ data: { status: filter } })
      .then((r) => setRows(r.candidatos))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [list, filter]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg md:text-xl font-bold">Candidatos a Corretor</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Documentação recebida via /ingresso</p>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as never)}>
          <TabsList>
            <TabsTrigger value="pendente_revisao">Pendentes</TabsTrigger>
            <TabsTrigger value="arquivado">Arquivados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum candidato encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:border-gold/60 transition" onClick={() => setSel(c)}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {REGIAO_LABEL[c.regiao] ?? c.regiao} • {c.telefone}{c.creci ? ` • CRECI ${c.creci}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "arquivado" ? "secondary" : "default"}>
                    {c.status === "arquivado" ? "Arquivado" : "Pendente"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CandidatoSheet candidato={sel} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  );
}

function CandidatoSheet({ candidato, onClose, onChanged }: { candidato: CandidatoRow | null; onClose: () => void; onChanged: () => void }) {
  const getUrls = useServerFn(getCandidatoDocUrls);
  const salvarDrive = useServerFn(salvarCandidatoNoDrive);
  const [urls, setUrls] = useState<{ rg: string | null; cpf: string | null; creci: string | null; comprovante: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!candidato) { setUrls(null); return; }
    getUrls({ data: { candidatoId: candidato.id } }).then(setUrls).catch(() => setUrls(null));
  }, [candidato, getUrls]);

  async function handleSalvarDrive() {
    if (!candidato) return;
    setSaving(true);
    try {
      await salvarDrive({ data: { candidatoId: candidato.id } });
      toast.success("Documentos salvos no Google Drive e candidato arquivado.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar no Drive");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!candidato} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {candidato && (
          <>
            <SheetHeader><SheetTitle>{candidato.nome}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">CPF:</span> {candidato.cpf}</div>
                <div><span className="text-muted-foreground">WhatsApp:</span> {candidato.telefone}</div>
                {candidato.email && <div><span className="text-muted-foreground">E-mail:</span> {candidato.email}</div>}
                {candidato.creci && <div><span className="text-muted-foreground">CRECI:</span> {candidato.creci}</div>}
                <div><span className="text-muted-foreground">Região:</span> {REGIAO_LABEL[candidato.regiao] ?? candidato.regiao}</div>
                <div><span className="text-muted-foreground">Status:</span> {candidato.status === "arquivado" ? "Arquivado no Drive" : "Pendente de revisão"}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Documentos</div>
                {(["rg", "cpf", "creci", "comprovante"] as const).map((slot) => {
                  const u = urls?.[slot];
                  return (
                    <div key={slot} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span className="capitalize flex items-center gap-2"><FileText className="h-4 w-4" /> {slot}</span>
                      {u ? (
                        <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-muted-foreground text-xs">não enviado</span>}
                    </div>
                  );
                })}
              </div>

              {candidato.lead_id && (
                <Link to="/leads/$leadId" params={{ leadId: candidato.lead_id }} className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
                  <Link2 className="h-4 w-4" /> Ver card no pipeline
                </Link>
              )}

              {candidato.status !== "arquivado" && (
                <Button onClick={handleSalvarDrive} disabled={saving} className="w-full bg-gold text-black hover:bg-gold/90">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><FolderUp className="h-4 w-4 mr-2" /> Salvar no Google Drive</>}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
