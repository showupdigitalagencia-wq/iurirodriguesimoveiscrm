import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);

  function goAfterAuth() {
    if (redirectTo && redirectTo.startsWith("/")) {
      window.location.assign(redirectTo);
    } else {
      navigate({ to: "/inicio" });
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) goAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")), password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      const uid = signInData.user?.id;
      if (uid) { const { startUserSession } = await import("@/lib/session-tracker"); await startUserSession(uid); }
      toast.success("Bem-vindo!"); goAfterAuth();
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Aurora/orbe dourada de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 10%, oklch(0.78 0.13 86 / 0.10), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 90%, oklch(0.50 0.14 270 / 0.18), transparent 60%)",
        }}
      />
      {/* Grade técnica sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.78 0.13 86) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.13 86) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <div className="text-[11px] uppercase tracking-[0.45em] text-muted-foreground">
            Iuri Rodrigues Imóveis
          </div>
          <div
            className="text-3xl font-semibold mt-2 text-gradient-gold"
            style={{ letterSpacing: "0.18em" }}
          >
            SISTEMA NEXUS
          </div>
          <div className="mx-auto mt-3 gold-divider w-32" />
        </Link>

        <div className="glass rounded-2xl p-7 gold-glow">
          <h2 className="text-base font-medium mb-5 text-center uppercase tracking-[0.25em] text-muted-foreground">
            Acesso
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="li-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="li-email"
                name="email"
                type="email"
                required
                className="mt-1.5 bg-background/40 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>
            <div>
              <Label htmlFor="li-pw" className="text-xs uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <Input
                id="li-pw"
                name="password"
                type="password"
                required
                className="mt-1.5 bg-background/40 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>
            <Button
              type="submit"
              variant="gold"
              className="w-full mt-2 tracking-[0.2em] uppercase text-sm gold-glow"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground/80 text-center mt-5 tracking-wide">
            Acesso exclusivo. Novas contas são criadas apenas pelo Administrador.
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] tracking-[0.3em] uppercase text-muted-foreground/60">
          CRECI 11379J · CNPJ 33.587.804/0001-98
        </p>
      </div>
      <Toaster richColors position="top-right" />
    </main>
  );
}
