import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enablePushFor, disablePush, getPushStatus, initOneSignal } from "@/lib/onesignal-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Sistema NEXUS" }] }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const [loading, setLoading] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [status, setStatus] = useState<{ permission: string; optedIn: boolean; externalId?: string } | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setSupported(false);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("responsavel_id, responsaveis:responsavel_id(id, nome)")
        .eq("id", uid)
        .maybeSingle();
      const resp = (prof?.responsaveis as { id: string; nome: string } | null) ?? null;
      setResponsavelId(resp?.id ?? null);
      setResponsavelNome(resp?.nome ?? null);
      await initOneSignal().catch(() => null);
      setStatus(await getPushStatus());
    })();
  }, []);

  async function handleEnable() {
    if (!responsavelId) {
      toast.error("Seu usuário não está vinculado a um corretor. Peça ao admin para vincular em Configurações.");
      return;
    }
    setLoading(true);
    const result = await enablePushFor(responsavelId);
    setLoading(false);
    if (result.ok) {
      toast.success("Notificações ativadas neste dispositivo!");
      setStatus(await getPushStatus());
    } else {
      toast.error(result.reason ?? "Falha ao ativar");
    }
  }

  async function handleDisable() {
    setLoading(true);
    await disablePush();
    setLoading(false);
    toast.success("Notificações desativadas");
    setStatus(await getPushStatus());
  }

  const isPreview =
    typeof window !== "undefined" &&
    (window.top !== window.self ||
      /^(id-preview--|preview--)/.test(window.location.hostname) ||
      window.location.hostname.endsWith(".lovableproject.com"));

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Notificações Push</h1>
        <p className="text-muted-foreground mt-1">
          Receba um alerta no seu celular sempre que chegar um lead seu.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-gold mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">Corretor vinculado</div>
            <div className="text-sm text-muted-foreground">
              {responsavelNome ?? "— (peça ao admin para vincular seu usuário em Configurações)"}
            </div>
          </div>
        </div>

        {!supported && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive p-3 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              Este navegador não suporta notificações push. Use Chrome, Edge ou Firefox no Android,
              ou Safari 16.4+ no iOS após instalar o app na tela inicial.
            </div>
          </div>
        )}

        {isPreview && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              Notificações só funcionam no app publicado.
              Abra <strong>iurirodriguesimoveiscrmcombr.lovable.app</strong> no seu celular para ativar.
            </div>
          </div>
        )}

        <div className="rounded-md bg-muted/50 p-4 text-sm">
          <div className="font-medium mb-2">Status neste dispositivo</div>
          <div className="space-y-1 text-muted-foreground">
            <div>Permissão do navegador: <strong>{status?.permission ?? "—"}</strong></div>
            <div>Inscrito no OneSignal: <strong>{status?.optedIn ? "sim" : "não"}</strong></div>
            {status?.externalId && (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Vinculado ao corretor: {status.externalId.slice(0, 8)}…
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleEnable}
            disabled={loading || !responsavelId || isPreview || !supported}
            variant="gold"
            className="flex-1"
          >
            <Bell className="h-4 w-4" />
            {status?.optedIn ? "Reativar" : "Ativar notificações"}
          </Button>
          {status?.optedIn && (
            <Button onClick={handleDisable} disabled={loading} variant="outline">
              <BellOff className="h-4 w-4" /> Desativar
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t border-border pt-4">
          <strong>Dica iPhone:</strong> abra o site no Safari → botão de compartilhar →
          <em> Adicionar à Tela Inicial</em>. Depois abra pelo ícone e ative aqui.
          <br />
          <strong>Android:</strong> Chrome vai oferecer "Instalar app". Aceite, abra pelo ícone e ative.
        </div>
      </div>
    </div>
  );
}
