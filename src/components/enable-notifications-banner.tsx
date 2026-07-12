import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { enablePushFor, initOneSignal, getPushStatus } from "@/lib/onesignal-client";
import { savePushExternalId } from "@/lib/push.functions";
import { toast } from "sonner";

const DISMISS_KEY = "nexus:enable-push-banner-dismissed-until";
// Snooze curto: 1 dia. Notificações são obrigatórias para o time.
const SNOOZE_MS = 24 * 60 * 60 * 1000;

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

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function EnableNotificationsBanner() {
  const saveExternalId = useServerFn(savePushExternalId);
  const [show, show_] = useState(false);
  const [denied, setDenied] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewOrIframe()) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

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

      // Já opted-in em outro fluxo? não mostra.
      try {
        const status = await getPushStatus();
        if (status.optedIn && status.externalId) return;
      } catch {
        /* ignore */
      }

      const permission =
        typeof Notification !== "undefined" ? Notification.permission : "default";

      // Se bloqueado: mostra SEMPRE com instruções (ignora snooze — é crítico).
      if (permission === "denied") {
        setDenied(true);
        show_(true);
        return;
      }

      // Snooze curto (1 dia) — não permite adiar por muito tempo.
      const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      if (dismissedUntil && Date.now() < dismissedUntil) return;

      show_(true);
    })();
  }, []);

  async function handleEnable() {
    if (!userId) return;
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
        // Reavalia se virou "denied".
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          setDenied(true);
        }
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
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    show_(false);
  }

  if (!show) return null;

  // Estado BLOQUEADO: usuário negou permissão. Mostra instruções por plataforma, sem dismiss.
  if (denied) {
    const platform = detectPlatform();
    return (
      <div className="rounded-2xl border border-red-500/50 bg-red-500/10 backdrop-blur p-4 flex items-start gap-3 shadow-lg">
        <div className="rounded-full bg-red-500/20 p-2 shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-red-100">
            Notificações bloqueadas neste aparelho
          </div>
          <p className="text-sm text-red-100/80 mt-1">
            Sem elas você vai perder leads e avisos importantes. Reative manualmente:
          </p>
          <ul className="mt-2 text-xs text-red-100/90 space-y-1 list-disc pl-4">
            {platform === "ios" && (
              <>
                <li>Abra <b>Ajustes › Notificações › Sistema NEXUS</b> e ative "Permitir Notificações".</li>
                <li>Se não aparecer, adicione o site à Tela de Início pelo Safari (compartilhar › Adicionar à Tela de Início) e abra por lá.</li>
              </>
            )}
            {platform === "android" && (
              <>
                <li>Toque no cadeado ao lado do endereço › <b>Permissões › Notificações › Permitir</b>.</li>
                <li>Ou <b>Ajustes › Apps › Chrome/Sistema NEXUS › Notificações</b>.</li>
              </>
            )}
            {platform === "desktop" && (
              <li>Clique no cadeado ao lado da URL › <b>Notificações › Permitir</b>, depois recarregue a página.</li>
            )}
          </ul>
          <div className="mt-3">
            <Button size="sm" variant="outline" asChild>
              <Link to="/notificacoes">Testar após reativar</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Estado normal: ainda não ativou.
  return (
    <div className="rounded-2xl border border-gold/40 bg-card/80 backdrop-blur p-4 flex items-start gap-3 shadow-lg">
      <div className="rounded-full bg-gold/15 p-2 shrink-0">
        <Bell className="h-5 w-5 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">Ative as notificações</div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Obrigatório para receber leads em tempo real. Sem isso você perde oportunidades.
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
        aria-label="Lembrar amanhã"
        title="Lembrar amanhã"
        className="text-muted-foreground hover:text-foreground p-1 rounded-md"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
