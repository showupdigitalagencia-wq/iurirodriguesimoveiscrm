import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, Loader2, Send, CalendarClock } from "lucide-react";
import { listInstitucionalCandidatos, type InstitucionalReuniaoInfo } from "@/lib/candidatos.functions";

export const Route = createFileRoute("/_authenticated/executivos/landing-page")({
  ssr: false,
  head: () => ({ meta: [{ title: "Landing Page — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: LPPage,
});

function buildMsg(nome: string, url: string) {
  const first = (nome || "").trim().split(" ")[0] || nome;
  return `Olá ${first}! 😊 Foi um prazer ter você\nna nossa reunião institucional!\n\nPara finalizar sua entrada no Ecossistema\nNexus, acesse o link abaixo e envie sua\ndocumentação:\n\n${url}\n\nQualquer dúvida, estamos à disposição!\nIuri Rodrigues Imóveis 🏢`;
}


function LPPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [url, setUrl] = useState("");
  const [reuniao, setReuniao] = useState<InstitucionalReuniaoInfo>(null);
  const [loadingMeet, setLoadingMeet] = useState(true);
  const fetchCandidatos = useServerFn(listInstitucionalCandidatos);

  useEffect(() => {
    setUrl("https://sistemanexus.app/cadastro");
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async () => {
      try {
        const res = await fetchCandidatos();
        if (active) setReuniao(res.reuniao);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Erro ao carregar reunião");
      } finally {
        if (active) setLoadingMeet(false);
      }
    };

    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { if (active) setAuthorized(false); return; }
      const [{ data: roles }, { data: isExec }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("current_user_is_executivo"),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      const isAdministrativo = (roles ?? []).some((r) => r.role === "administrativo");
      const ok = isAdmin || isAdministrativo || isExec === true;
      if (!active) return;
      setAuthorized(ok);
      if (!ok) return;

      await refresh();

      channel = supabase
        .channel("lp-institucional")
        .on("postgres_changes", { event: "*", schema: "public", table: "reuniao_participantes" }, () => { refresh(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "reunioes" }, () => { refresh(); })
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchCandidatos]);


  if (authorized === null) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (!authorized) return <div className="p-8 text-muted-foreground">Acesso negado.</div>;

  async function copy() {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      toast.success("Link copiado!");
    } catch { toast.error("Não foi possível copiar"); }
  }

  function openLink() { if (url) window.open(url, "_blank", "noopener,noreferrer"); }

  function sendToCandidato(nome: string, telefone: string) {
    const digits = (telefone || "").replace(/\D/g, "");
    if (!digits) { toast.error("Candidato sem telefone"); return; }
    const msg = buildMsg(nome, url);
    const href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Landing Page de Captação</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie o link aos candidatos da reunião institucional para receber a documentação.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Link público</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input readOnly value={url} className="font-mono text-sm flex-1 min-w-[240px]" />
            <Button type="button" onClick={copy} variant="outline"><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
            <Button type="button" onClick={openLink} variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Abrir</Button>
          </div>
          <p className="text-xs text-muted-foreground">Use este link para candidatos que não estão na lista abaixo.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Candidatos da reunião institucional de hoje</CardTitle>
            {reuniao && <Badge>Hoje</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {loadingMeet ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : !reuniao ? (
            <p className="text-sm text-muted-foreground">Nenhuma reunião institucional hoje.</p>
          ) : reuniao.candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">A reunião "{reuniao.titulo}" ainda não possui candidatos. Novos participantes aparecerão aqui automaticamente.</p>
          ) : (
            <ul className="divide-y">
              {reuniao.candidatos.map((c) => (
                <li key={c.lead_id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.telefone || "Sem telefone"}{c.executivo ? ` • Executivo: ${c.executivo}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => sendToCandidato(c.nome, c.telefone)}
                    className="bg-[#25D366] hover:bg-[#1ebd5b] text-white"
                  >
                    <Send className="h-4 w-4 mr-2" /> Enviar link
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Pré-visualização</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border bg-black" style={{ height: 720 }}>
            <iframe src="/cadastro" title="Preview LP" className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
