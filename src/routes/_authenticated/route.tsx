import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, Kanban, Users, BarChart3, Settings, LogOut, Bell, BadgeCheck, UserCog, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { urgencyForLead, type LeadRow } from "@/lib/lead-helpers";

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
  { to: "/usuarios", label: "Usuários", icon: UserCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AuthLayout() {
  const router = useRouter();
  const [pendentes, setPendentes] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const navItems = useMemo(() => isAdmin ? [...NAV, ...ADMIN_NAV] : NAV, [isAdmin]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) return;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => { if (active) setIsAdmin(data?.role === "admin"); });
    });

    async function refresh() {
      const { data } = await supabase
        .from("leads")
        .select("id, created_at, first_response_at, etapa")
        .is("first_response_at", null)
        .in("etapa", ["novos_leads", "em_atendimento"]);
      if (!active) return;
      const urgentes = (data ?? []).filter((l) => urgencyForLead(l as LeadRow).level !== "ok").length;
      setPendentes(urgentes);
    }
    refresh();
    const interval = setInterval(refresh, 60000);
    const channel = supabase
      .channel("leads-new")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const r = payload.new as { nome?: string };
        toast.success(`Novo lead: ${r.nome ?? "sem nome"}`);
        refresh();
      })
      .subscribe();
    return () => { active = false; clearInterval(interval); supabase.removeChannel(channel); };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-6 border-b border-sidebar-border">
          <div className="text-[10px] uppercase tracking-[0.3em] text-sidebar-foreground/60">Iuri Rodrigues</div>
          <div className="text-xl font-bold text-gold mt-0.5">CRM Imóveis</div>
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
          {pendentes > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/15 text-destructive text-xs font-medium animate-pulse-red">
              <Bell className="h-3.5 w-3.5" /> {pendentes} em alerta
            </div>
          )}
          <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
