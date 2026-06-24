import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { enablePushFor, initOneSignal, getPushStatus } from "@/lib/onesignal-client";
import { savePushExternalId } from "@/lib/push.functions";
import { toast } from "sonner";

const DISMISS_KEY = "nexus:enable-push-banner-dismissed-until";

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

export function EnableNotificationsBanner() {
  const saveExternalId = useServerFn(savePushExternalId);
  const [show, show_] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewOrIframe()) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedUntil && Date.now() < dismissedUntil) return;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      setUserId(uid);

      const [{ data: prof }, { data: userRole }] = await Promise.all([
        supabase
          .from("profiles")
          .select("onesignal_external_id, responsavel_id")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      ]);

      setResponsavelId(prof?.responsavel_id ?? null);
      setRole((userRole?.role as string | undefined) ?? null);

      // Já configurado no perfil → não mostra.
      if (prof?.onesignal_external_id) return;

      // Permissão já concedida em outro fluxo + opted-in? não mostra.
      try {
        const status = await getPushStatus();
        if (status.optedIn && status.externalId) return;
      } catch {
        /* ignore */
      }

      // Browser já bloqueou explicitamente → não insiste.
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

      show_(true);
    })();
  }, []);

  async function handleEnable() {
    if (!userId) return;
    // Corretores precisam estar vinculados; sem responsavel_id, manda para a tela completa.
    if (!responsavelId && role !== "admin" && role !== "corretor_vendas") {
      toast.error("Seu usuário não está vinculado a um corretor. Peça ao admin em Configurações.");
      return;
    }
    const externalId = responsavelId ?? userId;
    setLoading(true);
    try {
      await initOneSignal().catch(() => null);
      const result = await enablePushFor(externalId);
      if (!result.ok) {
        toast.error(result.reason ?? "Não foi possível ativar");
        return;
      }
      await saveExternalId({
        data: { enabled: true, externalId: result.externalId ?? externalId, responsavelId },
      });
      toast.success("Notificações ativadas!");
      show_(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações");
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    // Lembra de novo daqui a 3 dias.
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + 3 * 24 * 60 * 60 * 1000),
    );
    show_(false);
  }

  if (!show) return null;

  return (
    <div className="rounded-2xl border border-gold/40 bg-card/80 backdrop-blur p-4 flex items-start gap-3 shadow-lg">
      <div className="rounded-full bg-gold/15 p-2 shrink-0">
        <Bell className="h-5 w-5 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">Ative as notificações</div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Não perca nenhum lead ou aviso importante.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleEnable} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar agora"}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/notificacoes">Configurar</Link>
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Lembrar depois"
        className="text-muted-foreground hover:text-foreground p-1 rounded-md"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
