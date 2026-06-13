import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, Kanban, Users, BarChart3, Settings, LogOut, BadgeCheck, UserCog, BellRing, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { endUserSession, startUserSession } from "@/lib/session-tracker";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/corretores", label: "Corretores", icon: BadgeCheck },
  { to: "/relatorio", label: "Relatórios", icon: BarChart3 },
  { to: "/notificacoes", label: "Notificações", icon: BellRing },
] as const;

const ADMIN_NAV = [
  { to: "/tempo-acesso", label: "Tempo de Acesso", icon: Clock },
  { to: "/usuarios", label: "Usuários", icon: UserCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AuthLayout() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  const navItems = useMemo(() => isAdmin ? [...NAV, ...ADMIN_NAV] : NAV, [isAdmin]);

  useEffect(() => {
    let active = true;
    import("@/lib/onesignal-client").then((m) => m.initOneSignal()).catch(() => null);
    supabase.auth.getUser().then(({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) return;
      startUserSession(userId);
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => { if (active) setIsAdmin(data?.role === "admin"); });
    });

    const channel = supabase
      .channel("leads-new")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const r = payload.new as { nome?: string };
        toast.success(`Novo lead: ${r.nome ?? "sem nome"}`);
      })
      .subscribe();

    const onUnload = () => { endUserSession(); };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  async function logout() {
    await endUserSession();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar — inalterado */}
      <aside className="hidden md:flex w-60 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="px-5 py-6 border-b border-sidebar-border">
          <div className="text-[10px] uppercase tracking-[0.3em] text-sidebar-foreground/60">Iuri Rodrigues Imóveis</div>
          <div className="text-xl font-bold text-gold mt-0.5">Sistema NEXUS</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors [&.active]:bg-sidebar-accent [&.active]:text-gold"
                activeProps={{ className: "active" }}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header compacto mobile — respeita safe-area do iPhone */}
        <header
          className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border"
          style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          <div className="min-w-0 py-2">
            <div className="text-[9px] uppercase tracking-[0.25em] text-sidebar-foreground/60 truncate">Iuri Rodrigues Imóveis</div>
            <div className="text-base font-bold text-gold leading-tight truncate">Sistema NEXUS</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={logout} variant="ghost" size="icon" className="h-11 w-11 text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]">
          <ul className="flex items-stretch justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="flex-1">
                  <Link to={item.to}
                    className="flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] text-sidebar-foreground/80 hover:text-gold [&.active]:text-gold"
                    activeProps={{ className: "active" }}>
                    <Icon className="h-5 w-5" />
                    <span className="leading-none truncate max-w-[64px]">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
