import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Kanban, Users, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas")({
  beforeLoad: async () => {
    // gate: precisa estar logado, ser admin ou corretor_vendas, E toggle ativo
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });

    const [{ data: roles }, { data: cfg }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("configuracoes").select("valor").eq("chave", "sistema_corretores_ativo").maybeSingle(),
      supabase.from("profiles").select("vendas_acesso").eq("id", uid).maybeSingle(),
    ]);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    const isCorretorVendas = roles?.some((r) => r.role === "corretor_vendas") ?? false;
    const ativo = cfg?.valor === true;
    const acessoIndividual = (prof as { vendas_acesso?: boolean } | null)?.vendas_acesso === true;

    // Admin sempre passa. Corretor passa se (toggle global ON) OU (acesso individual liberado).
    if (!isAdmin && !(isCorretorVendas && (ativo || acessoIndividual))) {
      throw redirect({ to: "/dashboard" });
    }
    return { isAdmin, isCorretorVendas, ativo };
  },
  component: VendasLayout,
});

const TABS = [
  { to: "/vendas", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendas/pipeline", label: "Pipeline", icon: Kanban, exact: false },
  { to: "/vendas/leads", label: "Leads", icon: Users, exact: false },
] as const;

function VendasLayout() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corretores de Vendas</h1>
          <p className="text-sm text-muted-foreground">Pipeline de compra e locação</p>
        </div>
      </div>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              activeProps={{ className: "border-gold text-gold" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 border-transparent text-muted-foreground hover:text-foreground"
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
