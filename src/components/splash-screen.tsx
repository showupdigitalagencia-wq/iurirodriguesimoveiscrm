import { useEffect, useState } from "react";

const SESSION_KEY = "nexus_splash_shown";
const GOLD = "#D4AF37";
const GOLD_BRIGHT = "#F0D060";
const NAVY = "#0A0E1A";

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
    const hideTimer = setTimeout(() => setHiding(true), 4200);
    const removeTimer = setTimeout(() => setShow(false), 4900);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-700 ${
        hiding ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: `radial-gradient(ellipse at center, #0F1626 0%, ${NAVY} 70%)`,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Logo "N" dourado */}
      <div
        className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl mb-8 animate-splash-logo"
        style={{
          background: `linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))`,
          border: `1px solid ${GOLD}55`,
          boxShadow: `0 0 40px ${GOLD}40, inset 0 0 20px ${GOLD}15`,
        }}
      >
        <span
          className="text-5xl sm:text-6xl font-display font-bold"
          style={{
            background: `linear-gradient(135deg, ${GOLD_BRIGHT}, ${GOLD})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: `0 0 30px ${GOLD}80`,
          }}
        >
          N
        </span>
      </div>

      <div
        className="my-2 h-px w-0 animate-splash-line"
        style={{
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }}
      />

      <h1
        className="text-4xl sm:text-5xl font-light text-center px-6 mt-4 animate-splash-glow"
        style={{
          color: "#E8EAF0",
          letterSpacing: "0.35em",
          animationDelay: "1.2s",
          animationFillMode: "both",
        }}
      >
        SISTEMA NEXUS
      </h1>

      <p
        className="mt-5 text-sm sm:text-base tracking-[0.2em] uppercase animate-fade-in"
        style={{
          color: GOLD,
          animationDelay: "1.8s",
          animationDuration: "1s",
          animationFillMode: "both",
          textShadow: `0 0 12px ${GOLD}55`,
        }}
      >
        Iuri Rodrigues Imóveis
      </p>

      <style>{`
        @keyframes splash-logo {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-splash-logo {
          animation: splash-logo 0.9s ease-out 0.1s both;
        }
        @keyframes splash-line {
          0% { width: 0; opacity: 0; }
          100% { width: 14rem; opacity: 1; }
        }
        .animate-splash-line {
          animation: splash-line 1s ease-out 0.9s forwards;
        }
        @keyframes splash-glow {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-splash-glow {
          animation: splash-glow 1s ease-out forwards;
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
