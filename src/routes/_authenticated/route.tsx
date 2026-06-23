import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, Kanban, Users, BarChart3, Settings, LogOut, BadgeCheck, UserCog, BellRing, Clock, CalendarDays, MoreHorizontal, Briefcase, Users2, Building2, Megaphone, Banknote, Share2, CalendarClock, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { endUserSession, startUserSession } from "@/lib/session-tracker";
import { LauraChat } from "@/components/sophia-chat";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});


const NAV = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/dashboard", label: "Centro de Comando", icon: LayoutDashboard },
  { to: "/pipeline", label: "Negócios", icon: Kanban },
  { to: "/leads", label: "Oportunidades", icon: Users },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/corretores", label: "Corretores", icon: BadgeCheck },
  { to: "/relatorio", label: "Relatórios", icon: BarChart3 },
  { to: "/notificacoes", label: "Notificações", icon: BellRing },
] as const;

// Itens visíveis na bottom bar mobile (máx 5)
const MOBILE_BOTTOM = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/dashboard", label: "Centro de Comando", icon: LayoutDashboard },
  { to: "/pipeline", label: "Negócios", icon: Kanban },
  { to: "/leads", label: "Oportunidades", icon: Users },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
] as const;

// Bottom bar exclusiva do corretor de vendas (5 itens — Plantão entra, sino fica no topo)
const CORRETOR_MOBILE_BOTTOM = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/vendas/leads", label: "Oportunidades", icon: Users },
  { to: "/vendas/pipeline", label: "Negócios", icon: Kanban },
  { to: "/vendas/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/vendas/plantao", label: "Plantão", icon: CalendarClock },
] as const;

// Ícones do topo mobile (direita)
const MOBILE_TOP_ICONS = [
  { to: "/notificacoes", label: "Notificações", icon: BellRing },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const ADMIN_NAV = [
  { to: "/executivos", label: "Executivos", icon: Users2 },
  { to: "/tempo-acesso", label: "Tempo de Acesso", icon: Clock },
  { to: "/usuarios", label: "Equipe Nexus", icon: UserCog },
] as const;

const CONFIG_NAV = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

// Rotas permitidas para corretor_vendas (puro)
const CORRETOR_ALLOWED_PREFIXES = ["/inicio", "/vendas", "/notificacoes", "/configuracoes"];
// Rotas permitidas para administrativo (puro)
const ADMINISTRATIVO_ALLOWED_PREFIXES = ["/inicio", "/admin", "/executivos/landing-page", "/notificacoes", "/configuracoes"];
// Rotas permitidas para correspondente_bancaria (puro)
const CORRESPONDENTE_ALLOWED_PREFIXES = ["/inicio", "/correspondente", "/notificacoes", "/configuracoes"];


function AuthLayout() {
  const router = useRouter();
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [hasNoRole, setHasNoRole] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCorretorVendas, setIsCorretorVendas] = useState(false);
  const [isAdministrativo, setIsAdministrativo] = useState(false);
  const [isCorrespondente, setIsCorrespondente] = useState(false);
  const [vendasAtivo, setVendasAtivo] = useState(false);
  const [vendasAcessoIndividual, setVendasAcessoIndividual] = useState(false);
  const [adminModuloAtivo, setAdminModuloAtivo] = useState(false);
  const [canCandidatos, setCanCandidatos] = useState(false);
  const [isExec, setIsExec] = useState(false);

  const navItems = useMemo(() => {
    const corretorPodeVer = isCorretorVendas && (vendasAtivo || vendasAcessoIndividual);
    // Correspondente bancária pura: só Financiamento
    if (isCorrespondente && !isAdmin && !isCorretorVendas && !isAdministrativo) {
      return [
        { to: "/inicio", label: "Início", icon: Home },
        { to: "/correspondente", label: "Financiamento", icon: Banknote },
        { to: "/notificacoes", label: "Notificações", icon: BellRing },
        { to: "/configuracoes", label: "Configurações", icon: Settings },
      ];
    }
    // Administrativo puro: só módulo Administração
    if (isAdministrativo && !isAdmin && !isCorretorVendas) {
      const items: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [
        { to: "/inicio", label: "Início", icon: Home },
      ];
      if (adminModuloAtivo) {
        items.push(
          { to: "/admin", label: "Administração", icon: Building2 },
          { to: "/executivos/landing-page", label: "Landing Page", icon: Megaphone },
          { to: "/notificacoes", label: "Notificações", icon: BellRing },
          { to: "/configuracoes", label: "Configurações", icon: Settings },
        );
      }
      return items;
    }
    // Corretor de vendas: vê apenas as funções do sistema de vendas
    if (isCorretorVendas && !isAdmin) {
      const items: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [
        { to: "/inicio", label: "Início", icon: Home },
      ];
      if (corretorPodeVer) {
        items.push(
          { to: "/vendas", label: "Dashboard", icon: LayoutDashboard },
          { to: "/vendas/leads", label: "Leads", icon: Users },
          { to: "/vendas/pipeline", label: "Pipeline", icon: Kanban },
          { to: "/vendas/agenda", label: "Agenda", icon: CalendarDays },
          { to: "/vendas/plantao", label: "Plantão", icon: CalendarClock },
          { to: "/notificacoes", label: "Notificações", icon: BellRing },
          { to: "/configuracoes", label: "Configurações", icon: Settings },
        );
      }
      return items;
    }
    const base: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [...NAV];
    if ((isAdmin || isExec) && vendasAtivo) base.push({ to: "/vendas", label: "Vendas", icon: Briefcase });
    if (isAdmin && adminModuloAtivo) base.push({ to: "/admin", label: "Administração", icon: Building2 });
    if (isAdmin || isExec) base.push({ to: "/executivos/landing-page", label: "Landing Page", icon: Megaphone });
    if (isAdmin || isExec) base.push({ to: "/captacao-links", label: "Links de Captação", icon: Share2 });
    if (isAdmin) base.push({ to: "/correspondente", label: "Financiamento", icon: Banknote });
    return isAdmin ? [...base, ...ADMIN_NAV, ...CONFIG_NAV] : [...base, ...CONFIG_NAV];
  }, [isAdmin, isCorretorVendas, isAdministrativo, isCorrespondente, vendasAtivo, vendasAcessoIndividual, adminModuloAtivo, isExec]);

  useEffect(() => {
    let active = true;
    import("@/lib/onesignal-client").then((m) => m.initOneSignal()).catch(() => null);
    supabase.auth.getUser().then(({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) return;
      setUserEmail(userData.user?.email ?? "");
      startUserSession(userId);
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .then(({ data }) => {
          if (!active) return;
          const roles = (data ?? []).map((r) => r.role);
          setIsAdmin(roles.includes("admin"));
          setIsCorretorVendas(roles.includes("corretor_vendas"));
          setIsAdministrativo(roles.includes("administrativo"));
          setIsCorrespondente(roles.includes("correspondente_bancaria"));
          setHasNoRole(roles.length === 0);
          setRolesLoaded(true);
        });
      supabase.from("configuracoes").select("valor").eq("chave", "sistema_corretores_ativo").maybeSingle()
        .then(({ data }) => { if (active) setVendasAtivo(data?.valor === true); });
      supabase.from("configuracoes").select("valor").eq("chave", "modulo_administrativo_ativo").maybeSingle()
        .then(({ data }) => { if (active) setAdminModuloAtivo(data?.valor === true); });
      supabase.from("profiles").select("vendas_acesso, ativo").eq("id", userId).maybeSingle()
        .then(({ data }) => {
          if (!active) return;
          const p = data as { vendas_acesso?: boolean; ativo?: boolean } | null;
          setVendasAcessoIndividual(p?.vendas_acesso === true);
          setAccessRevoked(p?.ativo === false);
        });
      supabase.rpc("can_view_candidatos").then(({ data }) => { if (active) setCanCandidatos(data === true); });
      supabase.rpc("current_user_is_executivo").then(({ data }) => { if (active) setIsExec(data === true); });
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

  // Redireciona corretor_vendas para /vendas se tentar acessar rotas não permitidas
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (isCorrespondente && !isAdmin && !isCorretorVendas && !isAdministrativo) {
      const allowed = CORRESPONDENTE_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) router.navigate({ to: "/correspondente" });
    } else if (isCorretorVendas && !isAdmin) {
      const allowed = CORRETOR_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) router.navigate({ to: "/vendas" });
    } else if (isAdministrativo && !isAdmin && !isCorretorVendas) {
      const allowed = ADMINISTRATIVO_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) router.navigate({ to: "/admin" });
    }
  }, [isCorretorVendas, isAdministrativo, isCorrespondente, isAdmin, pathname, router]);

  async function logout() {
    await endUserSession();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  const mobileTopItems = MOBILE_TOP_ICONS;

  if (rolesLoaded && hasNoRole) {
    const desativado = accessRevoked;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center bg-sidebar text-sidebar-foreground rounded-lg p-8 border border-sidebar-border">
          <div className="text-[10px] uppercase tracking-[0.3em] text-sidebar-foreground/60">Iuri Rodrigues Imóveis</div>
          <div className="text-xl font-bold text-gold mt-0.5 mb-6">Sistema NEXUS</div>
          <h1 className={`text-lg font-semibold mb-2 ${desativado ? "text-red-400" : ""}`}>
            {desativado ? "Acesso desativado" : "Aguardando liberação de acesso"}
          </h1>
          <p className="text-sm text-sidebar-foreground/80 mb-2">
            Conta: <span className="text-gold">{userEmail}</span>
          </p>
          <p className="text-sm text-sidebar-foreground/70 mb-6">
            {desativado
              ? "Seu acesso foi desativado. Entre em contato com a administração para mais informações."
              : "Um administrador precisa atribuir seu perfil de acesso antes que você possa usar o sistema. Você receberá acesso em breve."}
          </p>
          <Button onClick={logout} variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    );
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
              <Link key={item.to} to={item.to as "/dashboard"}
                activeOptions={item.to === "/vendas" ? { exact: true } : undefined}
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
        {/* Header mobile: logo à esquerda, ícones à direita */}
        <header
          className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border"
          style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(3.25rem + env(safe-area-inset-top))" }}
        >
          <div className="min-w-0 py-2">
            <div className="text-[9px] uppercase tracking-[0.25em] text-sidebar-foreground/60 truncate">Iuri Rodrigues Imóveis</div>
            <div className="text-sm font-bold text-gold leading-tight truncate">Sistema NEXUS</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mobileTopItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} aria-label={item.label}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-accent [&.active]:text-gold"
                  activeProps={{ className: "active" }}>
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
            <Button onClick={logout} variant="ghost" size="icon" className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
          <footer className="w-full px-4 py-3 text-center text-[11px] text-muted-foreground/70 border-t border-border/50">
            Iuri Rodrigues Imóveis — CRECI 11379J — CNPJ 33.587.804/0001-98
          </footer>
        </main>

        {/* Bottom nav mobile — derivado de navItems para garantir paridade com desktop */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]">
          {isCorretorVendas && !isAdmin ? (
            <ul className="grid grid-cols-5 items-stretch">
              {CORRETOR_MOBILE_BOTTOM.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link to={item.to}
                      activeOptions={item.to === "/inicio" ? { exact: true } : undefined}
                      className="flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-medium text-sidebar-foreground/80 hover:text-gold [&.active]:text-gold"
                      activeProps={{ className: "active" }}>
                      <Icon className="h-5 w-5" />
                      <span className="leading-none truncate max-w-[68px]">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (() => {
            // Para todos os outros perfis (admin, exec, administrativo, correspondente):
            // deriva direto de navItems (mesma fonte do menu desktop), garantindo paridade total.
            // Itens já presentes no header mobile (top icons) são removidos para evitar duplicação.
            const topPaths = new Set<string>(mobileTopItems.map((t) => t.to));
            const filtered = navItems.filter((i) => !topPaths.has(i.to));
            const primary = filtered.slice(0, 4);
            const overflow = filtered.slice(4);
            const showOverflow = overflow.length > 0;
            return (
              <ul className="grid grid-cols-5 items-stretch">
                {primary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link to={item.to}
                        activeOptions={item.to === "/vendas" || item.to === "/admin" ? { exact: true } : undefined}
                        className="flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-medium text-sidebar-foreground/80 hover:text-gold [&.active]:text-gold"
                        activeProps={{ className: "active" }}>
                        <Icon className="h-5 w-5" />
                        <span className="leading-none truncate max-w-[68px]">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
                {showOverflow && (
                  <li>
                    <Sheet>
                      <SheetTrigger asChild>
                        <button
                          className="flex flex-col items-center justify-center gap-1 h-16 w-full text-[10px] font-medium text-sidebar-foreground/80 hover:text-gold"
                          aria-label="Mais"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                          <span className="leading-none">Mais</span>
                        </button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                        <SheetHeader>
                          <SheetTitle className="text-gold">Menu</SheetTitle>
                        </SheetHeader>
                        <ul className="mt-4 grid gap-1 max-h-[70vh] overflow-y-auto">
                          {overflow.map((item) => {
                            const Icon = item.icon;
                            return (
                              <li key={item.to}>
                                <Link to={item.to}
                                  activeOptions={item.to === "/vendas" || item.to === "/admin" ? { exact: true } : undefined}
                                  className="flex items-center gap-3 px-3 py-3 rounded-md text-sm hover:bg-sidebar-accent [&.active]:bg-sidebar-accent [&.active]:text-gold"
                                  activeProps={{ className: "active" }}>
                                  <Icon className="h-5 w-5" />
                                  {item.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </SheetContent>
                    </Sheet>
                  </li>
                )}
              </ul>
            );
          })()}
        </nav>

      </div>

      {isAdmin && <LauraChat />}
      <Toaster richColors position="top-right" />
    </div>
  );
}
