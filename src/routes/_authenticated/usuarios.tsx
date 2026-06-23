import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, KeyRound, Trash2, ShieldCheck, ShieldOff, CalendarClock, Pencil } from "lucide-react";
import { listUsers, createUser, updateUser, resetUserPassword, deleteUser, getMyRole } from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Equipe Nexus — Sistema NEXUS" }, { name: "robots", content: "noindex" }] }),
  component: UsuariosPage,
});

type UserRole = "admin" | "corretor" | "corretor_vendas" | "correspondente_bancaria" | "administrativo";
type UserRow = {
  id: string; email: string; nome: string; ativo: boolean;
  responsavel_id: string | null; role: UserRole;
  vendas_acesso: boolean;
  plantao_elegivel: boolean;
  last_sign_in_at: string | null; created_at: string;
};

type Responsavel = { id: string; nome: string; canal: string };
const NO_RESPONSAVEL = "sem-responsavel";

function UsuariosPage() {
  const fnList = useServerFn(listUsers);
  const fnCreate = useServerFn(createUser);
  const fnUpdate = useServerFn(updateUser);
  const fnReset = useServerFn(resetUserPassword);
  const fnDelete = useServerFn(deleteUser);
  const fnRole = useServerFn(getMyRole);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);


  const refresh = useCallback(async () => {
    try {
      const data = await fnList();
      setUsers(data as UserRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [fnList]);

  useEffect(() => {
    (async () => {
      try {
        const { role } = await fnRole();
        const admin = role === "admin";
        setIsAdmin(admin);
        if (!admin) { setLoading(false); return; }
        const { data: resps } = await supabase.from("responsaveis").select("id, nome, canal");
        setResponsaveis((resps ?? []) as Responsavel[]);
        await refresh();
      } catch {
        setIsAdmin(false); setLoading(false);
      }
    })();
  }, [fnRole, refresh]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const respId = String(fd.get("responsavel_id") || "");
    const password = String(fd.get("password"));
    const confirm = String(fd.get("password_confirm"));
    const role = String(fd.get("role")) as UserRole;
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }
    if (role === "corretor_vendas" && (!respId || respId === NO_RESPONSAVEL)) {
      toast.error("Selecione o executivo responsável pelo corretor"); return;
    }
    try {
      await fnCreate({ data: {
        nome: String(fd.get("nome")), email: String(fd.get("email")),
        password, role,
        responsavel_id: respId === NO_RESPONSAVEL ? null : respId,
      }});
      toast.success("Funcionário criado");
      setOpenNew(false);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function toggleAtivo(u: UserRow) {
    try {
      await fnUpdate({ data: { id: u.id, ativo: !u.ativo } });
      toast.success(u.ativo ? "Usuário desativado" : "Usuário reativado");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function changeRole(u: UserRow, role: UserRole) {
    try {
      await fnUpdate({ data: { id: u.id, role } });
      toast.success("Papel atualizado");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function changeResp(u: UserRow, responsavel_id: string) {
    try {
      await fnUpdate({ data: { id: u.id, responsavel_id: responsavel_id === NO_RESPONSAVEL ? null : responsavel_id } });
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function toggleVendasAcesso(u: UserRow) {
    try {
      await fnUpdate({ data: { id: u.id, vendas_acesso: !u.vendas_acesso } });
      toast.success(!u.vendas_acesso ? "Acesso ao Vendas liberado" : "Acesso ao Vendas removido");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function togglePlantaoElegivel(u: UserRow) {
    try {
      await fnUpdate({ data: { id: u.id, plantao_elegivel: !u.plantao_elegivel } });
      toast.success(!u.plantao_elegivel ? "Incluído no pool do Plantão" : "Removido do pool do Plantão");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetting) return;
    const fd = new FormData(e.currentTarget);
    try {
      await fnReset({ data: { id: resetting.id, password: String(fd.get("password")) } });
      toast.success("Senha redefinida");
      setResetting(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    const email = String(fd.get("email") || "").trim();
    if (!nome) { toast.error("Nome obrigatório"); return; }
    if (!email) { toast.error("Email obrigatório"); return; }
    try {
      const payload: { id: string; nome?: string; email?: string } = { id: editing.id };
      if (nome !== editing.nome) payload.nome = nome;
      if (email !== editing.email) payload.email = email;
      if (!payload.nome && !payload.email) { setEditing(null); return; }
      await fnUpdate({ data: payload });
      toast.success("Dados atualizados");
      setEditing(null);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function handleDelete(u: UserRow) {

    if (!confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await fnDelete({ data: { id: u.id } });
      toast.success("Usuário excluído");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (isAdmin === false) return <div className="p-8 text-muted-foreground">Acesso restrito a administradores.</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Equipe Nexus</h1>
          <p className="text-sm text-muted-foreground">Gerencie funcionários, papéis e acessos ao sistema.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild><Button variant="gold" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Novo funcionário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar funcionário</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div><Label>Nome completo</Label><Input name="nome" required maxLength={120} className="mt-1.5" /></div>
              <div><Label>Email (login)</Label><Input name="email" type="email" required maxLength={255} className="mt-1.5" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Senha provisória</Label><Input name="password" type="text" required minLength={6} maxLength={128} className="mt-1.5" /></div>
                <div><Label>Confirmar senha</Label><Input name="password_confirm" type="text" required minLength={6} maxLength={128} className="mt-1.5" /></div>
              </div>
              <div>
                <Label>Papel</Label>
                <Select name="role" defaultValue="corretor">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Executivo</SelectItem>
                    <SelectItem value="corretor_vendas">Corretor (Vendas)</SelectItem>
                    <SelectItem value="correspondente_bancaria">Correspondente Bancária</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Executivo responsável <span className="text-xs text-muted-foreground">(obrigatório p/ Corretor)</span></Label>
                <Select name="responsavel_id" defaultValue={NO_RESPONSAVEL}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RESPONSAVEL}>Nenhum</SelectItem>
                    {responsaveis.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.canal})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" variant="gold">Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Mobile: cards empilhados */}
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{u.nome || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              {u.ativo
                ? <Badge variant="secondary" className="gap-1 shrink-0"><ShieldCheck className="h-3 w-3" /> Ativo</Badge>
                : <Badge variant="destructive" className="gap-1 shrink-0"><ShieldOff className="h-3 w-3" /> Bloqueado</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <Label className="text-xs">Papel</Label>
                <Select value={u.role} onValueChange={(v) => changeRole(u, v as UserRole)}>
                  <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Executivo</SelectItem>
                    <SelectItem value="corretor_vendas">Corretor (Vendas)</SelectItem>
                    <SelectItem value="correspondente_bancaria">Correspondente Bancária</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={u.responsavel_id ?? NO_RESPONSAVEL} onValueChange={(v) => changeResp(u, v)}>
                  <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RESPONSAVEL}>—</SelectItem>
                    {responsaveis.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Último acesso: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca"}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={u.ativo} onCheckedChange={() => toggleAtivo(u)} />
                <span className="text-xs">{u.ativo ? "Ativo" : "Bloqueado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={u.vendas_acesso} onCheckedChange={() => toggleVendasAcesso(u)} />
                <span className={`text-xs ${u.vendas_acesso ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Vendas {u.vendas_acesso ? "ON" : "OFF"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Elegível p/ Plantão</span>
              <div className="flex items-center gap-2">
                <Switch checked={u.plantao_elegivel} onCheckedChange={() => togglePlantaoElegivel(u)} />
                <span className={`text-xs ${u.plantao_elegivel ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {u.plantao_elegivel ? "Sim" : "Não"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(u)} className="flex-1">
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setResetting(u)} className="flex-1">
                <KeyRound className="h-4 w-4 mr-1" /> Senha
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(u)} className="flex-1 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </div>

          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center text-muted-foreground py-8 bg-card border border-border rounded-xl">Nenhum usuário cadastrado.</div>
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Funcionário</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3">Último acesso</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Acesso Vendas</th>
              <th className="text-left px-4 py-3">Plantão</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v as UserRole)}>
                    <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corretor">Executivo</SelectItem>
                      <SelectItem value="corretor_vendas">Corretor (Vendas)</SelectItem>
                      <SelectItem value="correspondente_bancaria">Correspondente Bancária</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={u.responsavel_id ?? NO_RESPONSAVEL} onValueChange={(v) => changeResp(u, v)}>
                    <SelectTrigger className="w-44 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_RESPONSAVEL}>—</SelectItem>
                      {responsaveis.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={u.ativo} onCheckedChange={() => toggleAtivo(u)} />
                    {u.ativo
                      ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Ativo</Badge>
                      : <Badge variant="destructive" className="gap-1"><ShieldOff className="h-3 w-3" /> Bloqueado</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={u.vendas_acesso} onCheckedChange={() => toggleVendasAcesso(u)} />
                    {u.vendas_acesso
                      ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Liberado</Badge>
                      : <Badge variant="outline" className="gap-1 text-muted-foreground"><ShieldOff className="h-3 w-3" /> Bloqueado</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={u.plantao_elegivel} onCheckedChange={() => togglePlantaoElegivel(u)} />
                    {u.plantao_elegivel
                      ? <Badge variant="secondary" className="gap-1"><CalendarClock className="h-3 w-3" /> Elegível</Badge>
                      : <Badge variant="outline" className="gap-1 text-muted-foreground">—</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(u)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setResetting(u)} title="Redefinir senha">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(u)} title="Excluir" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>

              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha — {resetting?.email}</DialogTitle></DialogHeader>
          <form onSubmit={handleReset} className="space-y-3">
            <div><Label>Nova senha (mín. 6)</Label><Input name="password" type="text" required minLength={6} maxLength={128} className="mt-1.5" /></div>
            <DialogFooter><Button type="submit" variant="gold">Atualizar senha</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar funcionário</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={handleEdit} className="space-y-3">
              <div><Label>Nome completo</Label><Input name="nome" defaultValue={editing.nome} required maxLength={120} className="mt-1.5" /></div>
              <div>
                <Label>Email (login)</Label>
                <Input name="email" type="email" defaultValue={editing.email} required maxLength={255} className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">Alterar o email muda o login do usuário.</p>
              </div>
              <DialogFooter><Button type="submit" variant="gold">Salvar</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

