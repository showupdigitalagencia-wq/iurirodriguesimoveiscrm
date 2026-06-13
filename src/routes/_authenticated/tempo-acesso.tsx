import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Trophy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/tempo-acesso")({
  head: () => ({ meta: [{ title: "Tempo de Acesso — Sistema NEXUS" }] }),
  component: TempoAcessoPage,
});

type SessionRow = {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  duration_seconds: number | null;
};

type Profile = { id: string; nome: string | null };

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
}

function effectiveDuration(s: SessionRow, now: number): number {
  if (s.duration_seconds != null) return s.duration_seconds;
  if (s.logout_at) {
    return Math.max(0, Math.floor((new Date(s.logout_at).getTime() - new Date(s.login_at).getTime()) / 1000));
  }
  return Math.max(0, Math.floor((now - new Date(s.login_at).getTime()) / 1000));
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return x; }
function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1); }

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function TempoAcessoPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { navigate({ to: "/dashboard" }); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      const admin = roleRow?.role === "admin";
      setIsAdmin(admin);
      if (!admin) { navigate({ to: "/dashboard" }); return; }

      const [{ data: sessRows }, { data: profRows }] = await Promise.all([
        supabase.from("user_sessions" as never).select("*").order("login_at", { ascending: false }).limit(2000),
        supabase.from("profiles").select("id, nome"),
      ]);
      setSessions((sessRows ?? []) as SessionRow[]);
      const map: Record<string, string> = {};
      ((profRows ?? []) as Profile[]).forEach((p) => { map[p.id] = p.nome ?? "Sem nome"; });
      setProfiles(map);
      setLoading(false);
    });
  }, [navigate]);

  const now = Date.now();
  const todayStart = startOfDay(new Date()).getTime();
  const weekStart = startOfWeek(new Date()).getTime();
  const monthStart = startOfMonth(new Date()).getTime();
  const yearStart = startOfYear(new Date()).getTime();

  const filtered = useMemo(
    () => selectedUser === "all" ? sessions : sessions.filter((s) => s.user_id === selectedUser),
    [sessions, selectedUser]
  );

  function totalsFor(rows: SessionRow[]) {
    let today = 0, week = 0, month = 0, year = 0;
    for (const s of rows) {
      const start = new Date(s.login_at).getTime();
      const dur = effectiveDuration(s, now);
      if (start >= todayStart) today += dur;
      if (start >= weekStart) week += dur;
      if (start >= monthStart) month += dur;
      if (start >= yearStart) year += dur;
    }
    return { today, week, month, year };
  }

  const totals = totalsFor(filtered);

  // Ranking (sempre todos)
  const ranking = useMemo(() => {
    const byUser = new Map<string, number>();
    for (const s of sessions) {
      const dur = effectiveDuration(s, now);
      byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + dur);
    }
    return Array.from(byUser.entries())
      .map(([uid, total]) => ({ uid, nome: profiles[uid] ?? "—", total }))
      .sort((a, b) => b.total - a.total);
  }, [sessions, profiles, now]);

  // Por dia da semana (do filtro)
  const dowData = useMemo(() => {
    const arr = DOW.map((d) => ({ dia: d, segundos: 0 }));
    for (const s of filtered) {
      const date = new Date(s.login_at);
      arr[date.getDay()].segundos += effectiveDuration(s, now);
    }
    return arr.map((d) => ({ ...d, horas: +(d.segundos / 3600).toFixed(2) }));
  }, [filtered, now]);

  const userOptions = useMemo(() => {
    const ids = Array.from(new Set(sessions.map((s) => s.user_id)));
    return ids.map((id) => ({ id, nome: profiles[id] ?? "—" })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [sessions, profiles]);

  if (isAdmin === null || loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!isAdmin) return null;

  const cards = [
    { label: "Hoje", value: formatDuration(totals.today) },
    { label: "Esta semana", value: formatDuration(totals.week) },
    { label: "Este mês", value: formatDuration(totals.month) },
    { label: "Este ano", value: formatDuration(totals.year) },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tempo de Acesso</h1>
          <p className="text-muted-foreground text-sm mt-1">Tempo total de uso do sistema por usuário.</p>
        </div>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="all">Todos os usuários</option>
          {userOptions.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs md:text-sm text-muted-foreground">{c.label}</span>
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <div className="mt-2 text-xl md:text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-gold" /> Ranking de acesso</h2>
        <div className="space-y-2">
          {ranking.length === 0 && <p className="text-sm text-muted-foreground">Sem dados de sessão ainda.</p>}
          {ranking.map((r, i) => (
            <div key={r.uid} className="flex items-center justify-between p-3 rounded-md bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold w-6 text-gold">#{i + 1}</span>
                <span className="text-sm truncate">{r.nome}</span>
              </div>
              <span className="text-sm font-medium">{formatDuration(r.total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h2 className="font-semibold mb-3">Acesso por dia da semana</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip formatter={(v: number) => `${v} h`} />
              <Legend />
              <Bar dataKey="horas" name="Horas" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h2 className="font-semibold mb-3">Histórico de sessões</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Usuário</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Entrada</th>
                <th className="py-2 pr-3">Saída</th>
                <th className="py-2 pr-3">Duração</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => {
                const loginDate = new Date(s.login_at);
                const logoutDate = s.logout_at ? new Date(s.logout_at) : null;
                const dur = effectiveDuration(s, now);
                return (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{profiles[s.user_id] ?? "—"}</td>
                    <td className="py-2 pr-3">{format(loginDate, "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="py-2 pr-3">{format(loginDate, "HH:mm:ss")}</td>
                    <td className="py-2 pr-3">{logoutDate ? format(logoutDate, "HH:mm:ss") : <span className="text-muted-foreground">em curso</span>}</td>
                    <td className="py-2 pr-3 font-medium">{formatDuration(dur)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem sessões registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
