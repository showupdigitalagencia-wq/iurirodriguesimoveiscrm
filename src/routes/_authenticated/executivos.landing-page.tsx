import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/executivos/landing-page")({
  ssr: false,
  head: () => ({ meta: [{ title: "Landing Page — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: LPPage,
});

function LPPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setUrl(`${window.location.origin}/ingresso`);
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { setAuthorized(false); return; }
      const [{ data: roles }, { data: isExec }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("current_user_is_executivo"),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      const isAdministrativo = (roles ?? []).some((r) => r.role === "administrativo");
      setAuthorized(isAdmin || isAdministrativo || isExec === true);
    });
  }, []);

  if (authorized === null) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (!authorized) return <div className="p-8 text-muted-foreground">Acesso negado.</div>;

  const msg = `Olá! 😊 Foi um prazer ter você na nossa\nreunião institucional!\n\nPara finalizar sua entrada no Ecossistema\nNexus, acesse o link abaixo e envie sua\ndocumentação:\n\n${url}\n\nQualquer dúvida, estamos à disposição!\nIuri Rodrigues Imóveis 🏢`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(msg)}`;

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
  function openWhatsApp() { window.open(waHref, "_blank", "noopener,noreferrer"); }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Landing Page de Captação</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie o link aos candidatos para receber a documentação direto no sistema.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Link público</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input readOnly value={url} className="font-mono text-sm flex-1 min-w-[240px]" />
            <Button type="button" onClick={copy} variant="outline"><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
            <Button type="button" onClick={openLink} variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Abrir</Button>
          </div>
          <Button type="button" onClick={openWhatsApp} className="bg-[#25D366] hover:bg-[#1ebd5b] text-white">
            <MessageCircle className="h-4 w-4 mr-2" /> Enviar por WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pré-visualização</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border bg-black" style={{ height: 720 }}>
            <iframe src="/ingresso" title="Preview LP" className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
