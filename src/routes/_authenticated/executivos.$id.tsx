import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getExecutivoDetalhe, updateExecutivoRegiao, setCorretorAtivo } from "@/lib/executivos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, MapPin, Save, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/executivos/$id")({
  head: () => ({ meta: [{ title: "Equipe do Executivo — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: ExecutivoDetalhePage,
});

type Corretor = {
  id: string;
  profile_id: string | null;
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
  const fnAtivo = useServerFn(setCorretorAtivo);

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

  const toggleAcesso = async (profileId: string | null, ativo: boolean) => {
    if (!profileId) {
      toast.error("Corretor sem conta de acesso vinculada");
      return;
    }
    try {
      await fnAtivo({ data: { profile_id: profileId, ativo } });
      toast.success(ativo ? "Acesso liberado" : "Acesso revogado");
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

          <div className="rounded-md bg-muted p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">Corretores ativos</div>
            <div className="text-2xl font-bold">{equipeStats.ativos}</div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Equipe ativa de {executivo.nome} ({equipeStats.ativos})</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {corretores.map((c) => {
          const tel = c.telefone?.replace(/\D/g, "") ?? "";
          return (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{c.nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{c.nome}</div>
                      <Badge className="text-[10px]">Ativo</Badge>
                    </div>
                    {c.telefone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{c.telefone}
                      </div>
                    )}
                    {c.regiao && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{c.regiao}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  {tel ? (
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  ) : <div className="flex-1" />}
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Acesso</span>
                    <Switch
                      checked={c.ativo}
                      disabled={!c.profile_id}
                      onCheckedChange={(v) => toggleAcesso(c.profile_id, v)}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {corretores.length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">Nenhum corretor ativo nesta equipe ainda.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
