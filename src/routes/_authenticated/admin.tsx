import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Building2, FileText, DollarSign, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const [{ data: roles }, { data: cfg }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("configuracoes").select("valor").eq("chave", "modulo_administrativo_ativo").maybeSingle(),
    ]);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    const isAdministrativo = roles?.some((r) => r.role === "administrativo") ?? false;
    const ativo = cfg?.valor === true;
    if (!isAdmin && !(isAdministrativo && ativo)) {
      throw redirect({ to: "/dashboard" });
    }
    return { isAdmin, isAdministrativo };
  },
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/imoveis", label: "Imóveis", icon: Building2, exact: false },
  { to: "/admin/contratos", label: "Contratos", icon: FileText, exact: false },
] as const;

function AdminLayout() {
  return (
    <div className="p-3 md:p-6 space-y-4 pb-24 md:pb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Administração Imobiliária</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Imóveis, contratos e gestão de locação</p>
      </div>
      <nav className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
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
