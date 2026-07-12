import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { enablePushFor, initOneSignal, getPushStatus } from "@/lib/onesignal-client";
import { savePushExternalId } from "@/lib/push.functions";
import { toast } from "sonner";

const SNOOZE_KEY = "nexus:enable-push-modal-snoozed-until";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 1 dia

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h.endsWith(".lovableproject.com") || h.endsWith(".lovableproject-dev.com")) return true;
  if (h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function EnableNotificationsModal() {
  const saveExternalId = useServerFn(savePushExternalId);
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
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
          .select("onesignal_external_id, responsavel_id, responsaveis:responsavel_id(onesignal_external_id)")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      ]);

      const respPush =
        (prof?.responsaveis as { onesignal_external_id: string | null } | null)?.onesignal_external_id ?? null;
      setResponsavelId(prof?.responsavel_id ?? null);
      setRole((userRole?.role as string | undefined) ?? null);

      // Já configurado — não mostra.
      if (prof?.onesignal_external_id || respPush) return;

      try {
        const status = await getPushStatus();
        if (status.optedIn && status.externalId) return;
      } catch {
        /* ignore */
      }

      const permission = typeof Notification !== "undefined" ? Notification.permission : "default";

      if (permission === "denied") {
        setDenied(true);
        setOpen(true); // bloqueado → sempre aparece
        return;
      }

      const snoozedUntil = Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
      if (snoozedUntil && Date.now() < snoozedUntil) return;

      setOpen(true);
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
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          setDenied(true);
        }
        return;
      }
      await saveExternalId({
        data: { enabled: true, externalId: result.externalId ?? externalId, responsavelId },
      });
      toast.success("Notificações ativadas! Você está pronto para receber os leads em tempo real.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações");
    } finally {
      setLoading(false);
    }
  }

  function handleSnooze() {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  }

  const platform = detectPlatform();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Se bloqueado, não permite fechar clicando fora — só via instruções.
        if (denied) return;
        if (!v) handleSnooze();
      }}
    >
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => { if (denied) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (denied) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="mx-auto rounded-full bg-gold/15 p-3 w-fit mb-2">
            {denied ? <AlertTriangle className="h-6 w-6 text-red-500" /> : <Bell className="h-6 w-6 text-gold" />}
          </div>
          <DialogTitle className="text-center">
            {denied ? "Notificações bloqueadas" : "Ative as notificações"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {denied
              ? "Você bloqueou as notificações neste aparelho. Sem elas, você perde leads e avisos importantes em tempo real."
              : "Recado da administração: mantenha as notificações sempre ativas para receber leads e avisos assim que chegam. É obrigatório para todo o time."}
          </DialogDescription>
        </DialogHeader>

        {denied ? (
          <div className="rounded-md bg-muted/60 p-3 text-sm space-y-2">
            <div className="font-medium">Como reativar neste aparelho:</div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {platform === "ios" && (
                <>
                  <li>Abra <b>Ajustes › Notificações › Sistema NEXUS</b> e ative "Permitir Notificações".</li>
                  <li>Se não aparecer, adicione o site à Tela de Início pelo Safari (compartilhar › Adicionar à Tela de Início) e abra pelo ícone.</li>
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
            <div className="pt-2">
              <Button size="sm" variant="outline" className="w-full" onClick={() => window.location.reload()}>
                Já reativei — recarregar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleEnable} disabled={loading} variant="gold" className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Ativar agora
            </Button>
            <Button onClick={handleSnooze} variant="ghost" size="sm" className="w-full">
              Lembrar amanhã
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
