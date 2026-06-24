import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  return false;
}

/**
 * Extrai um fingerprint do HTML carregado: srcs dos <script type=module> +
 * hrefs dos <link rel=modulepreload|stylesheet> servidos pela raiz `/assets`.
 * Como o Vite gera nomes com hash, qualquer deploy novo muda o fingerprint.
 */
function fingerprintFromHtml(html: string): string {
  const matches = html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) ?? [];
  return Array.from(new Set(matches)).sort().join("|");
}

function fingerprintFromDocument(): string {
  if (typeof document === "undefined") return "";
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      'script[src*="/assets/"], link[href*="/assets/"]',
    ),
  );
  const urls = nodes
    .map((n) => n.getAttribute("src") ?? n.getAttribute("href") ?? "")
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u, window.location.origin).pathname;
      } catch {
        return u;
      }
    })
    .filter((p) => p.startsWith("/assets/"));
  return Array.from(new Set(urls)).sort().join("|");
}

const SNOOZE_KEY = "update-banner-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozedFor(fingerprint: string): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const { fp, until } = JSON.parse(raw) as { fp: string; until: number };
    if (fp !== fingerprint) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function snooze(fingerprint: string) {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      JSON.stringify({ fp: fingerprint, until: Date.now() + SNOOZE_MS }),
    );
  } catch {
    /* ignore */
  }
}

export function UpdateAvailableBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [freshFp, setFreshFp] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isPreviewOrIframe()) return;
    const current = fingerprintFromDocument();
    if (!current) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/?_v=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "x-update-check": "1" },
        });
        if (!res.ok) return;
        const html = await res.text();
        const fresh = fingerprintFromHtml(html);
        if (!fresh) return;
        if (fresh !== current && !cancelled) {
          if (snoozedFor(fresh)) return;
          setFreshFp(fresh);
          setUpdateReady(true);
        }
      } catch {
        /* offline / network — ignore */
      }
    }

    // Primeira checagem após 30s e depois a cada 5 minutos.
    const first = window.setTimeout(check, 30_000);
    const interval = window.setInterval(check, 5 * 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  function handleSnooze() {
    if (freshFp) snooze(freshFp);
    setUpdateReady(false);
  }


  async function handleUpdate() {
    setRefreshing(true);
    try {
      // Desregistra workers (OneSignal mantém o seu — apenas força reload limpo).
      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          await Promise.allSettled(keys.map((k) => caches.delete(k)));
        } catch {
          /* ignore */
        }
      }
    } finally {
      // Reload bypass-cache.
      window.location.reload();
    }
  }

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-gold/40 bg-card/95 px-4 py-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <RefreshCw className="h-5 w-5 shrink-0 text-gold" />
        <div className="flex-1 text-sm">
          <div className="font-medium">Nova versão disponível</div>
          <div className="text-muted-foreground">
            Atualize para continuar usando todos os recursos.
          </div>
        </div>
        <Button size="sm" onClick={handleUpdate} disabled={refreshing} className="shrink-0">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar agora"}
        </Button>
      </div>
    </div>
  );
}
