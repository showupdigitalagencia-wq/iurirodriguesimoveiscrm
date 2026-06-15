import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExecutivos } from "@/lib/executivos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageCircle, Users, FileText, MapPin, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/executivos")({
  head: () => ({ meta: [{ title: "Executivos — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: ExecutivosPage,
});

type Exec = {
  id: string; nome: string; canal: string; whatsapp: string | null; ativo: boolean;
  regiao: string | null; total_corretores: number; leads_ativos: number;
};

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function ExecutivosPage() {
  const fn = useServerFn(listExecutivos);
  const [execs, setExecs] = useState<Exec[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fn();
      setExecs(data as Exec[]);
    } finally { setLoading(false); }
  }, [fn]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Executivos</h1>
        <p className="text-sm text-muted-foreground">Gestão de equipes de corretores por executivo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {execs.map((e) => (
          <Card key={e.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initials(e.nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Executivo</div>
                <CardTitle className="text-lg truncate">{e.nome}</CardTitle>
                {e.regiao && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{e.regiao}
                  </div>
                )}
              </div>
              {!e.ativo && <Badge variant="secondary">Inativo</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Corretores ativos</div>
                  <div className="text-xl font-bold">{e.total_corretores}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Leads</div>
                  <div className="text-xl font-bold">{e.leads_ativos}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {e.whatsapp && (
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={`https://wa.me/${e.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" className="flex-1">
                  <Link to="/executivos/$id" params={{ id: e.id }}>
                    Ver equipe <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
