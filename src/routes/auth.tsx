import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso — CRM Iuri Rodrigues" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")), password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Bem-vindo!"); navigate({ to: "/dashboard" }); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-6">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Iuri Rodrigues</div>
          <div className="text-2xl font-bold text-gold mt-1">CRM Imóveis</div>
        </Link>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label htmlFor="li-email">Email</Label><Input id="li-email" name="email" type="email" required className="mt-1.5" /></div>
            <div><Label htmlFor="li-pw">Senha</Label><Input id="li-pw" name="password" type="password" required className="mt-1.5" /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Acesso exclusivo para funcionários autorizados. Solicite credenciais ao administrador.
          </p>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </main>
  );
}
