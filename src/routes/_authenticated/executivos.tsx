import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExecutivos, createExecutivo } from "@/lib/executivos.functions";
import { getMyRole } from "@/lib/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MessageCircle, Users, FileText, MapPin, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/executivos")({
  head: () => ({ meta: [{ title: "Executivos — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: ExecutivosPage,
});

type Exec = {
  id: string; nome: string; canal: string; whatsapp: string | null; ativo: boolean;
  regiao: string | null; total_corretores: number; leads_ativos: number;
};

const REGIOES = [
  "Barra da Tijuca",
  "Recreio dos Bandeirantes",
  "Belford Roxo",
  "Mesquita/Nilópolis",
  "Outra",
];

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function ExecutivosPage() {
  const fn = useServerFn(listExecutivos);
  const fnCreate = useServerFn(createExecutivo);
  const fnRole = useServerFn(getMyRole);
  const [execs, setExecs] = useState<Exec[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regiaoSel, setRegiaoSel] = useState<string>("Barra da Tijuca");
  const [regiaoOutra, setRegiaoOutra] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await fn();
      setExecs(data as Exec[]);
    } finally { setLoading(false); }
  }, [fn]);

  useEffect(() => {
    (async () => {
      try {
        const { role } = await fnRole();
        setIsAdmin(role === "admin");
      } catch { /* ignore */ }
      refresh();
    })();
  }, [fnRole, refresh]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const regiao = regiaoSel === "Outra" ? regiaoOutra.trim() : regiaoSel;
    if (!regiao) { toast.error("Informe a região de atuação"); return; }
    setSubmitting(true);
    try {
      await fnCreate({ data: {
        nome: String(fd.get("nome") ?? "").trim(),
        email: String(fd.get("email") ?? "").trim(),
        password: String(fd.get("password") ?? ""),
        whatsapp: String(fd.get("whatsapp") ?? "").trim(),
        regiao,
      }});
      toast.success("Executivo cadastrado com sucesso");
      setOpen(false);
      setRegiaoSel("Barra da Tijuca"); setRegiaoOutra("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Executivos</h1>
          <p className="text-sm text-muted-foreground">Gestão de equipes de corretores por executivo</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="gold"><Plus className="h-4 w-4 mr-1" /> Cadastrar Executivo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Executivo</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div><Label>Nome completo</Label><Input name="nome" required maxLength={120} className="mt-1.5" /></div>
                <div><Label>Email (login)</Label><Input name="email" type="email" required maxLength={255} className="mt-1.5" /></div>
                <div><Label>Senha provisória</Label><Input name="password" type="text" required minLength={6} maxLength={128} className="mt-1.5" /></div>
                <div><Label>Telefone / WhatsApp</Label><Input name="whatsapp" required maxLength={40} placeholder="+55 21 9..." className="mt-1.5" /></div>
                <div>
                  <Label>Região de atuação</Label>
                  <Select value={regiaoSel} onValueChange={setRegiaoSel}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REGIOES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {regiaoSel === "Outra" && (
                  <div><Label>Informe a região</Label><Input value={regiaoOutra} onChange={(e) => setRegiaoOutra(e.target.value)} maxLength={200} className="mt-1.5" required /></div>
                )}
                <DialogFooter>
                  <Button type="submit" variant="gold" disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Cadastrando…</> : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
                  <Link to="/corretores" search={{ exec: e.id }}>
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
