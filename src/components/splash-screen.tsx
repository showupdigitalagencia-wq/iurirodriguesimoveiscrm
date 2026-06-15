import { useEffect, useState } from "react";

const SESSION_KEY = "nexus_splash_shown";
const GOLD = "#D4AF37";

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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        hiding ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <p
        className="text-2xl sm:text-3xl font-light tracking-wide text-white animate-fade-in"
        style={{ animationDelay: "0.2s", animationDuration: "1s", animationFillMode: "both" }}
      >
        Bem vindo ao
      </p>

      <div
        className="my-6 h-px w-0 animate-splash-line"
        style={{
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }}
      />

      <h1
        className="text-5xl sm:text-6xl font-bold tracking-tight text-center px-6 animate-splash-glow"
        style={{
          color: GOLD,
          animationDelay: "1.2s",
          animationFillMode: "both",
          textShadow: `0 0 20px ${GOLD}80, 0 0 40px ${GOLD}40`,
        }}
      >
        Ecossistema Nexus
      </h1>

      <style>{`
        @keyframes splash-line {
          0% { width: 0; opacity: 0; }
          100% { width: 12rem; opacity: 1; }
        }
        .animate-splash-line {
          animation: splash-line 1s ease-out 0.9s forwards;
        }
        @keyframes splash-glow {
          0% { opacity: 0; transform: scale(0.96); }
          30% { opacity: 1; transform: scale(1); }
          50% { text-shadow: 0 0 30px ${GOLD}, 0 0 60px ${GOLD}80; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); text-shadow: 0 0 20px ${GOLD}80, 0 0 40px ${GOLD}40; }
        }
        .animate-splash-glow {
          opacity: 0;
          animation: splash-glow 2.6s ease-in-out 1.2s infinite;
        }
      `}</style>
    </div>
  );
}
