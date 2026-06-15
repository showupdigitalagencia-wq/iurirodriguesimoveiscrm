import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getExecutivoDetalhe, updateExecutivoRegiao } from "@/lib/executivos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, MapPin, Save, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/executivos/$id")({
  head: () => ({ meta: [{ title: "Equipe do Executivo — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: ExecutivoDetalhePage,
});

type Corretor = {
  id: string;
  nome: string;
  telefone: string;
  regiao: string;
  ativo: boolean;
};
type Detalhe = {
  executivo: { id: string; nome: string; canal: string; whatsapp: string | null; ativo: boolean; regiao: string | null };
  corretores: Corretor[];
  equipeStats: { total: number; ativos: number };
};

function ExecutivoDetalhePage() {
  const { id } = Route.useParams();
  const fnDetalhe = useServerFn(getExecutivoDetalhe);
  const fnRegiao = useServerFn(updateExecutivoRegiao);

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [regiao, setRegiao] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await fnDetalhe({ data: { id } })) as Detalhe;
      setDetalhe(data);
      setRegiao(data.executivo.regiao ?? "");
    } finally { setLoading(false); }
  }, [fnDetalhe, id]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveRegiao = async () => {
    try {
      await fnRegiao({ data: { id, regiao: regiao.trim() || null } });
      toast.success("Região atualizada");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading || !detalhe) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { executivo, corretores, equipeStats } = detalhe;

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

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Corretores ativos</div>
              <div className="text-2xl font-bold">{equipeStats.ativos}</div>
            </div>
            <div className="rounded-md bg-muted p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Total da equipe</div>
              <div className="text-2xl font-bold">{equipeStats.total}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Equipe ativa ({equipeStats.ativos})</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {corretores.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{c.nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{c.nome}</div>
                  <Badge variant={c.ativo ? "default" : "secondary"} className="text-[10px]">
                    {c.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  {c.telefone && (
                    <a href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                      <Phone className="h-3 w-3" />{c.telefone}
                    </a>
                  )}
                </div>
                {c.regiao && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{c.regiao}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {corretores.length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">Nenhum corretor contratado nesta equipe ainda.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
