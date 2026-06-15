import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getExecutivoDetalhe, listCorretoresDisponiveis, listExecutivos, setCorretorExecutivo, updateExecutivoRegiao } from "@/lib/executivos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, MapPin, Plus, UserMinus, ArrowRightLeft, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/executivos/$id")({
  head: () => ({ meta: [{ title: "Equipe do Executivo — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: ExecutivoDetalhePage,
});

type Corretor = {
  id: string; nome: string; ativo: boolean; responsavel_id: string | null;
  stats: { total: number; ativos: number; fechados: number };
};
type Detalhe = {
  executivo: { id: string; nome: string; canal: string; whatsapp: string | null; ativo: boolean; regiao: string | null };
  corretores: Corretor[];
  equipeStats: { total: number; ativos: number; fechados: number };
};
type CorretorDisp = { id: string; nome: string; ativo: boolean; responsavel_id: string | null; executivo_nome: string | null };

function ExecutivoDetalhePage() {
  const { id } = Route.useParams();
  const fnDetalhe = useServerFn(getExecutivoDetalhe);
  const fnDisp = useServerFn(listCorretoresDisponiveis);
  const fnExecs = useServerFn(listExecutivos);
  const fnSet = useServerFn(setCorretorExecutivo);
  const fnRegiao = useServerFn(updateExecutivoRegiao);

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [disponiveis, setDisponiveis] = useState<CorretorDisp[]>([]);
  const [outrosExecs, setOutrosExecs] = useState<Array<{ id: string; nome: string }>>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [selectedCorretor, setSelectedCorretor] = useState<string>("");
  const [trocaFor, setTrocaFor] = useState<Corretor | null>(null);
  const [novoExec, setNovoExec] = useState<string>("");
  const [regiao, setRegiao] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fnDetalhe({ data: { id } });
      setDetalhe(data as Detalhe);
      setRegiao((data as Detalhe).executivo.regiao ?? "");
    } finally { setLoading(false); }
  }, [fnDetalhe, id]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadDisponiveis = async () => {
    const data = await fnDisp();
    setDisponiveis(data as CorretorDisp[]);
  };

  const handleAdd = async () => {
    if (!selectedCorretor) return;
    try {
      await fnSet({ data: { corretor_id: selectedCorretor, executivo_id: id } });
      toast.success("Corretor adicionado à equipe");
      setOpenAdd(false);
      setSelectedCorretor("");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleRemove = async (corretorId: string) => {
    if (!confirm("Remover este corretor da equipe?")) return;
    try {
      await fnSet({ data: { corretor_id: corretorId, executivo_id: null } });
      toast.success("Corretor removido");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleTrocar = async () => {
    if (!trocaFor || !novoExec) return;
    try {
      await fnSet({ data: { corretor_id: trocaFor.id, executivo_id: novoExec } });
      toast.success("Corretor transferido");
      setTrocaFor(null);
      setNovoExec("");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const saveRegiao = async () => {
    try {
      await fnRegiao({ data: { id, regiao: regiao.trim() || null } });
      toast.success("Região atualizada");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading || !detalhe) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { executivo, corretores, equipeStats } = detalhe;
  const corretoresLivres = disponiveis.filter((c) => c.responsavel_id !== id);
  const outrosExecsIds = new Set(corretores.map((c) => c.id));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/executivos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {executivo.nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Executivo</div>
            <CardTitle className="text-2xl">{executivo.nome}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Região de atuação</label>
              <Input value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Ex.: Zona Sul, Rio de Janeiro" />
            </div>
            <Button onClick={saveRegiao} size="sm"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-muted p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Equipe</div>
              <div className="text-2xl font-bold">{corretores.length}</div>
            </div>
            <div className="rounded-md bg-muted p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Leads ativos</div>
              <div className="text-2xl font-bold">{equipeStats.ativos}</div>
            </div>
            <div className="rounded-md bg-muted p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Fechados</div>
              <div className="text-2xl font-bold text-emerald-600">{equipeStats.fechados}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Equipe ({corretores.length})</h2>
        <Dialog open={openAdd} onOpenChange={(o) => { setOpenAdd(o); if (o) loadDisponiveis(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar corretor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar corretor à equipe</DialogTitle></DialogHeader>
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger><SelectValue placeholder="Selecione um corretor" /></SelectTrigger>
              <SelectContent>
                {corretoresLivres.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.executivo_nome ? `(atual: ${c.executivo_nome})` : "(sem executivo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={!selectedCorretor}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {corretores.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{c.nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{c.nome}</div>
                  <Badge variant={c.ativo ? "default" : "secondary"} className="text-[10px]">
                    {c.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.stats.total} leads · {c.stats.ativos} ativos · {c.stats.fechados} fechados
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" title="Trocar de equipe" onClick={() => { setTrocaFor(c); loadDisponiveis(); }}>
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" title="Remover da equipe" onClick={() => handleRemove(c.id)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {corretores.length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">Nenhum corretor nesta equipe.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!trocaFor} onOpenChange={async (o) => {
        if (!o) { setTrocaFor(null); setNovoExec(""); }
        else if (outrosExecs.length === 0) {
          const list = await fnExecs();
          setOutrosExecs((list as Array<{ id: string; nome: string }>).filter((e) => e.id !== id));
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trocar {trocaFor?.nome} de equipe</DialogTitle></DialogHeader>
          <Select value={novoExec} onValueChange={setNovoExec}>
            <SelectTrigger><SelectValue placeholder="Novo executivo" /></SelectTrigger>
            <SelectContent>
              {outrosExecs.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleTrocar} disabled={!novoExec}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
