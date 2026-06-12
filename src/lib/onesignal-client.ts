// OneSignal Web SDK v16 — client init + opt-in helpers.
// Loaded only in the browser, only in non-preview/non-iframe contexts.

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

let initStarted = false;

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

function loadSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) return resolve(window.OneSignal);
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (!existing) {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.defer = true;
      s.onerror = () => reject(new Error("Falha ao carregar SDK OneSignal"));
      document.head.appendChild(s);
    }
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      resolve(OneSignal);
    });
  });
}

export async function initOneSignal(): Promise<any | null> {
  if (typeof window === "undefined") return null;
  if (!APP_ID) {
    console.warn("[OneSignal] VITE_ONESIGNAL_APP_ID ausente");
    return null;
  }
  if (isPreviewOrIframe()) return null;
  if (initStarted) return loadSdk();
  initStarted = true;

  const OneSignal = await loadSdk();
  if (!OneSignal.__initialized) {
    await OneSignal.init({
      appId: APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
    });
    OneSignal.__initialized = true;
  }
  return OneSignal;
}

/** Solicita permissão e vincula corretor via external_id. */
export async function enablePushFor(externalId: string): Promise<{ ok: boolean; reason?: string }> {
  const OneSignal = await initOneSignal();
  if (!OneSignal) return { ok: false, reason: "SDK indisponível (preview/iframe ou App ID ausente)" };

  try {
    await OneSignal.Notifications.requestPermission();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Permissão negada" };
  }

  const permission: NotificationPermission = OneSignal.Notifications.permission
    ? "granted"
    : (typeof Notification !== "undefined" ? Notification.permission : "default");
  if (permission !== "granted") return { ok: false, reason: "Permissão não concedida" };

  try {
    await OneSignal.login(externalId);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha ao vincular usuário" };
  }
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const OneSignal = await initOneSignal();
  if (!OneSignal) return;
  try { await OneSignal.User.PushSubscription.optOut(); } catch { /* ignore */ }
  try { await OneSignal.logout(); } catch { /* ignore */ }
}

export async function getPushStatus(): Promise<{ permission: string; optedIn: boolean; externalId?: string }> {
  const OneSignal = await initOneSignal();
  if (!OneSignal) {
    return {
      permission: typeof Notification !== "undefined" ? Notification.permission : "default",
      optedIn: false,
    };
  }
  const optedIn = !!OneSignal.User?.PushSubscription?.optedIn;
  const externalId = OneSignal.User?.externalId;
  const permission =
    (typeof Notification !== "undefined" ? Notification.permission : "default");
  return { permission, optedIn, externalId };
}
