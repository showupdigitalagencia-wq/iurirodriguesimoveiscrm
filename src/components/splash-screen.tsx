import { useEffect, useState } from "react";

const SESSION_KEY = "nexus_splash_shown";

export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    setShow(true);
    const hideTimer = setTimeout(() => setHiding(true), 2400);
    const removeTimer = setTimeout(() => setShow(false), 2900);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        hiding ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        background:
          "radial-gradient(ellipse at center, hsl(var(--background)) 0%, #0b0b0c 100%)",
      }}
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl animate-scale-in"
        style={{
          background: "linear-gradient(135deg, #d4af37 0%, #b8860b 100%)",
          boxShadow: "0 10px 40px -10px rgba(212,175,55,0.6)",
        }}
      >
        <span className="text-4xl font-bold text-black">N</span>
      </div>

      <p
        className="mt-8 text-sm tracking-widest text-muted-foreground uppercase animate-fade-in"
        style={{ animationDelay: "0.4s", animationFillMode: "both" }}
      >
        Bem-vindo ao
      </p>

      <h1
        className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight animate-fade-in"
        style={{
          animationDelay: "0.8s",
          animationFillMode: "both",
          background: "linear-gradient(135deg, #f5d77a 0%, #d4af37 50%, #b8860b 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Ecossistema Nexus
      </h1>

      <div
        className="mt-10 h-0.5 w-24 overflow-hidden rounded-full bg-white/10 animate-fade-in"
        style={{ animationDelay: "1.2s", animationFillMode: "both" }}
      >
        <div
          className="h-full bg-gradient-to-r from-transparent via-[#d4af37] to-transparent"
          style={{ animation: "splash-loader 1.4s ease-in-out infinite" }}
        />
      </div>

      <style>{`
        @keyframes splash-loader {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
