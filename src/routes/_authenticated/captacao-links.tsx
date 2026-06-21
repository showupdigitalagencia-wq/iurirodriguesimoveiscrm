import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, MessageCircle, ExternalLink } from "lucide-react";
import {
  CAPTACAO_EXECUTIVOS,
  CAPTACAO_WHATSAPP_TEMPLATE,
  type CaptacaoExecutivo,
} from "@/lib/captacao.constants";

export const Route = createFileRoute("/_authenticated/captacao-links")({
  head: () => ({ meta: [{ title: "Links de Captação — Sistema NEXUS" }] }),
  component: CaptacaoLinksPage,
});

// Mapa primeiro nome (lowercase, sem acento) → ref
const NOME_TO_REF: Record<string, CaptacaoExecutivo["ref"]> = {
  robson: "barra",
  fabiola: "recreio",
  renata: "belford",
  denise: "mesquita",
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(" ")[0];
}

function buildLink(ref: string) {
  if (typeof window === "undefined") return `https://sistemanexus.app/seja-corretor?ref=${ref}`;
  return `${window.location.origin}/seja-corretor?ref=${ref}`;
}

function CaptacaoLinksPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meuRef, setMeuRef] = useState<CaptacaoExecutivo["ref"] | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        if (active) setLoading(false);
        return;
      }
      const [{ data: roles }, { data: execId }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("current_user_executivo_id"),
      ]);
      if (!active) return;
      const admin = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);

      let ref: CaptacaoExecutivo["ref"] | null = null;
      if (execId) {
        const { data: resp } = await supabase
          .from("responsaveis")
          .select("nome")
          .eq("id", execId as string)
          .maybeSingle();
        const first = normalize(resp?.nome ?? "");
        ref = NOME_TO_REF[first] ?? null;
      }
      setMeuRef(ref);

      if (!admin && !ref) setDenied(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const execsToShow = isAdmin
    ? CAPTACAO_EXECUTIVOS
    : meuRef
      ? CAPTACAO_EXECUTIVOS.filter((e) => e.ref === meuRef)
      : [];

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function shareWhatsApp(link: string) {
    const msg = CAPTACAO_WHATSAPP_TEMPLATE(link);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  if (denied) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">
          Esta página é exclusiva para admin e executivos.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Links de Captação de Corretores</h1>
        <p className="text-muted-foreground">
          Compartilhe seu link exclusivo para atrair novos corretores para sua região. Cada link é
          rastreado pelo parâmetro <code className="text-xs">?ref=</code>.
        </p>
      </header>

      {execsToShow.length === 0 && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          Nenhum link disponível para o seu perfil.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {execsToShow.map((exec) => {
          const link = buildLink(exec.ref);
          return (
            <div key={exec.ref} className="rounded-lg border p-5 space-y-4 bg-card">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {exec.regiao}
                </div>
                <h3 className="text-xl font-semibold text-gold">{exec.nome}</h3>
              </div>

              <div className="rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                {link}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copyLink(link)} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-1.5" /> Copiar link
                </Button>
                <Button
                  onClick={() => shareWhatsApp(link)}
                  variant="gold"
                  size="sm"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" /> Compartilhar no WhatsApp
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir LP
                  </a>
                </Button>
              </div>

              <div className="rounded-md overflow-hidden border" style={{ background: "#0a0a0a" }}>
                <iframe
                  src={link}
                  title={`Preview LP — ${exec.nome}`}
                  className="w-full"
                  style={{ height: 360, border: 0 }}
                  loading="lazy"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
