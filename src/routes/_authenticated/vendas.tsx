import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Kanban, Users, CalendarDays, BellRing, CalendarClock, Building2, BarChart3, Target, UsersRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas")({
  beforeLoad: async () => {
    // gate: precisa estar logado, ser admin ou corretor_vendas, E toggle ativo
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });

    const [{ data: roles }, { data: cfg }, { data: prof }, { data: isExecRpc }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("configuracoes").select("valor").eq("chave", "sistema_corretores_ativo").maybeSingle(),
      supabase.from("profiles").select("vendas_acesso").eq("id", uid).maybeSingle(),
      supabase.rpc("current_user_is_executivo"),
    ]);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    const isCorretorVendas = roles?.some((r) => r.role === "corretor_vendas") ?? false;
    const isExec = isExecRpc === true;
    const ativo = cfg?.valor === true;
    const acessoIndividual = (prof as { vendas_acesso?: boolean } | null)?.vendas_acesso === true;

    // Admin e Executivo sempre passam. Corretor passa se (toggle global ON) OU (acesso individual liberado).
    if (!isAdmin && !isExec && !(isCorretorVendas && (ativo || acessoIndividual))) {
      throw redirect({ to: "/dashboard" });
    }
    return { isAdmin, isCorretorVendas, isExec, ativo };
  },
  component: VendasLayout,
});

type TabDef = { to: string; label: string; icon: typeof LayoutDashboard; exact: boolean; adminOnly?: boolean; execOrAdminOnly?: boolean };
const TABS: readonly TabDef[] = [
  { to: "/vendas", label: "Centro de Comando", icon: LayoutDashboard, exact: true },
  { to: "/vendas/leads", label: "Oportunidades", icon: Users, exact: false },
  { to: "/vendas/pipeline", label: "Negócios", icon: Kanban, exact: false },
  { to: "/vendas/equipe", label: "Minha Equipe", icon: UsersRound, exact: false, execOrAdminOnly: true },
  { to: "/vendas/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { to: "/vendas/portfolio", label: "Portfólio", icon: Building2, exact: false },
  { to: "/vendas/plantao", label: "Plantão", icon: CalendarClock, exact: false },
  { to: "/vendas/relatorios", label: "Relatórios", icon: BarChart3, exact: false },
  { to: "/vendas/metas", label: "Metas", icon: Target, exact: false, adminOnly: true },
  { to: "/notificacoes", label: "Notificações", icon: BellRing, exact: false },
];

function VendasLayout() {
  const { isAdmin } = Route.useRouteContext();
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div data-vendas-root className="p-3 md:p-6 space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">Corretores de Vendas</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Pipeline de compra e locação</p>
        </div>
      </div>
      {/* Tabs mobile — scroll horizontal, sempre acessíveis */}
      <nav className="md:hidden -mx-3 px-3 flex gap-1 border-b overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              activeProps={{ className: "border-gold text-gold" }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 border-transparent text-muted-foreground hover:text-foreground min-h-[44px] whitespace-nowrap"
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>
      {/* Tabs desktop */}
      <nav className="hidden md:flex gap-1 border-b overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              activeProps={{ className: "border-gold text-gold" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 border-transparent text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
