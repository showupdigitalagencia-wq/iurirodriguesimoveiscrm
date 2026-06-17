import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CANAIS, REGIOES, type LeadCanal, type LeadRegiao } from "@/lib/lead-helpers";
import { Trash2, Copy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { startGoogleOAuth, getGoogleStatus, disconnectGoogle } from "@/lib/google.functions";

type Resp = { id: string; canal: string; nome: string; whatsapp: string };
type Mapping = {
  id: string;
  form_id: string;
  nome: string;
  regiao: LeadRegiao;
  canal: LeadCanal;
  ativo: boolean;
};

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Sistema NEXUS" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) { if (active) setIsAdmin(false); return; }
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle()
        .then(({ data }) => { if (active) setIsAdmin(!!data); });
    });
    return () => { active = false; };
  }, []);

  if (isAdmin === null) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 space-y-6 max-w-4xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua conta.</p>
        </header>
        <MinhaContaSection />
        <GoogleConnectSection />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Responsáveis, integrações e mapeamento de formulários.</p>
      </header>
      <Tabs defaultValue="conta">
        <TabsList>
          <TabsTrigger value="conta">Minha Conta</TabsTrigger>
          <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="formularios">Formulários Meta</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="conta" className="mt-6 space-y-6">
          <MinhaContaSection />
          <GoogleConnectSection />
        </TabsContent>
        <TabsContent value="responsaveis" className="mt-6">
          <ResponsaveisSection />
        </TabsContent>
        <TabsContent value="integracoes" className="mt-6">
          <IntegracoesSection />
        </TabsContent>
        <TabsContent value="formularios" className="mt-6">
          <FormulariosSection />
        </TabsContent>
        <TabsContent value="admin" className="mt-6 space-y-6">
          <SistemaCorretoresToggle />
          <ModuloAdministrativoToggle />
          <SophiaToggle chave="sophia_executivos_acesso" titulo="Liberar Laura para Executivos" descricao="Quando ativado, executivos podem usar a assistente Laura." />
          <SophiaToggle chave="sophia_corretores_acesso" titulo="Liberar Laura para Corretores" descricao="Quando ativado, corretores podem usar a assistente Laura." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SistemaCorretoresToggle() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", "sistema_corretores_ativo").maybeSingle()
      .then(({ data }) => setAtivo(data?.valor === true));
  }, []);

  async function toggle(v: boolean) {
    setSaving(true);
    const { error } = await supabase.from("configuracoes")
      .upsert({ chave: "sistema_corretores_ativo", valor: v as never, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    setAtivo(v);
    toast.success(v ? "Sistema de corretores liberado" : "Sistema de corretores desativado");
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Liberar sistema de Corretores de Vendas</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Quando ativado, o menu <strong>Vendas</strong> fica visível para administradores e corretores de vendas habilitados.
          </p>
        </div>
        <Switch checked={ativo === true} disabled={saving || ativo === null} onCheckedChange={toggle} />
      </div>
    </div>
  );
}

function ModuloAdministrativoToggle() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", "modulo_administrativo_ativo").maybeSingle()
      .then(({ data }) => setAtivo(data?.valor === true));
  }, []);

  async function toggle(v: boolean) {
    setSaving(true);
    const { error } = await supabase.from("configuracoes")
      .upsert({ chave: "modulo_administrativo_ativo", valor: v as never, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    setAtivo(v);
    toast.success(v ? "Módulo Administrativo liberado" : "Módulo Administrativo desativado");
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Liberar módulo Administrativo</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Quando ativado, o menu <strong>Administração</strong> (imóveis, contratos e locações) fica visível para administradores e usuários com perfil <strong>Administrativo</strong>.
          </p>
        </div>
        <Switch checked={ativo === true} disabled={saving || ativo === null} onCheckedChange={toggle} />
      </div>
    </div>
  );
}

function SophiaToggle({ chave, titulo, descricao }: { chave: string; titulo: string; descricao: string }) {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle()
      .then(({ data }) => setAtivo(data?.valor === true));
  }, [chave]);

  async function toggle(v: boolean) {
    setSaving(true);
    const { error } = await supabase.from("configuracoes")
      .upsert({ chave, valor: v as never, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    setAtivo(v);
    toast.success(v ? "Liberado" : "Desativado");
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">✨ {titulo}</h3>
          <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
        </div>
        <Switch checked={ativo === true} disabled={saving || ativo === null} onCheckedChange={toggle} />
      </div>
    </div>
  );
}





function MinhaContaSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A nova senha deve ter no mínimo 6 caracteres");
    if (newPassword !== confirmPassword) return toast.error("A nova senha e a confirmação não coincidem");

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        toast.error("Sessão expirada");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) {
        toast.error("Senha atual incorreta");
        return;
      }
      const { error: updError } = await supabase.auth.updateUser({ password: newPassword });
      if (updError) {
        toast.error(updError.message);
        return;
      }
      toast.success("Senha alterada com sucesso");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 max-w-md">
      <h2 className="font-semibold mb-1">Alterar senha</h2>
      <p className="text-sm text-muted-foreground mb-4">Informe sua senha atual e escolha uma nova.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label>Senha atual</Label>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" className="mt-1.5" />
        </div>
        <div>
          <Label>Nova senha (mín. 6)</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} maxLength={128} autoComplete="new-password" className="mt-1.5" />
        </div>
        <div>
          <Label>Confirmar nova senha</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} maxLength={128} autoComplete="new-password" className="mt-1.5" />
        </div>
        <Button type="submit" variant="gold" disabled={saving}>
          {saving ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </section>
  );
}

function ResponsaveisSection() {
  const [resps, setResps] = useState<Resp[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("responsaveis").select("id, canal, nome, whatsapp").then(({ data }) => {
      setResps((data as Resp[]) ?? []);
    });
  }, []);

  async function save(r: Resp) {
    setSaving(r.id);
    const { error } = await supabase.from("responsaveis")
      .update({ nome: r.nome, whatsapp: r.whatsapp.replace(/\D/g, "") })
      .eq("id", r.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="font-semibold">Responsáveis e WhatsApp</h2>
      {resps.map((r) => (
        <div key={r.id} className="grid md:grid-cols-[120px_1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Canal</Label>
            <div className="mt-1.5 px-3 py-2 bg-muted rounded-md text-sm">
              {CANAIS.find((c) => c.id === r.canal)?.nome ?? r.canal}
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={r.nome} onChange={(e) => setResps((p) => p.map((x) => x.id === r.id ? { ...x, nome: e.target.value } : x))} className="mt-1.5" />
          </div>
          <div>
            <Label>WhatsApp (com DDI 55)</Label>
            <Input value={r.whatsapp} onChange={(e) => setResps((p) => p.map((x) => x.id === r.id ? { ...x, whatsapp: e.target.value } : x))} placeholder="5521900000000" className="mt-1.5" />
          </div>
          <Button variant="gold" onClick={() => save(r)} disabled={saving === r.id}>
            {saving === r.id ? "..." : "Salvar"}
          </Button>
        </div>
      ))}
    </section>
  );
}

function IntegracoesSection() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/webhook`;
  const leadUrl = `${origin}/api/public/lead`;

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada");
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Webhook genérico (Zapier / Make / Meta)</h2>
        <p className="text-sm text-muted-foreground">
          Use esta URL no Zapier ou Make com o trigger <strong>Facebook Lead Ads → New Lead</strong> e ação <strong>Webhooks → POST</strong>. Aceita qualquer JSON com campos como nome, telefone, email, regiao, form_id.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Endpoint estruturado (formulário próprio)</h2>
        <p className="text-sm text-muted-foreground">
          Espera JSON com campos exatos: nome, telefone, regiao, tipo_imovel, faixa_valor.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={leadUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(leadUrl)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-2">Z-API</h2>
        <p className="text-sm text-muted-foreground">
          Credenciais Z-API armazenadas como segredos seguros no backend. Para atualizar, peça ao administrador para rotacionar os segredos.
        </p>
      </section>
    </div>
  );
}

function FormulariosSection() {
  const [items, setItems] = useState<Mapping[]>([]);
  const [novo, setNovo] = useState<Omit<Mapping, "id">>({
    form_id: "",
    nome: "",
    regiao: "barra_da_tijuca",
    canal: "denise",
    ativo: true,
  });
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("meta_form_mapping")
      .select("id, form_id, nome, regiao, canal, ativo")
      .order("created_at", { ascending: false });
    setItems((data as Mapping[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function adicionar() {
    if (!novo.form_id.trim() || !novo.nome.trim()) {
      toast.error("Preencha Form ID e nome");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("meta_form_mapping").insert(novo);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mapeamento criado");
    setNovo({ form_id: "", nome: "", regiao: "barra_da_tijuca", canal: "denise", ativo: true });
    load();
  }

  async function atualizar(id: string, patch: Partial<Mapping>) {
    const { error } = await supabase.from("meta_form_mapping").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  async function remover(id: string) {
    if (!confirm("Remover este mapeamento?")) return;
    const { error } = await supabase.from("meta_form_mapping").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      load();
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Novo mapeamento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vincule cada <strong>Form ID</strong> do Meta a uma região e um responsável. Quando o webhook receber um lead com esse form_id, ele será roteado automaticamente.
          </p>
        </div>
        <div className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label>Form ID (Meta)</Label>
            <Input value={novo.form_id} onChange={(e) => setNovo({ ...novo, form_id: e.target.value })} placeholder="1234567890" className="mt-1.5" />
          </div>
          <div>
            <Label>Nome do anúncio</Label>
            <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Barra - Lançamento X" className="mt-1.5" />
          </div>
          <div>
            <Label>Região</Label>
            <Select value={novo.regiao} onValueChange={(v) => setNovo({ ...novo, regiao: v as LeadRegiao })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={novo.canal} onValueChange={(v) => setNovo({ ...novo, canal: v as LeadCanal })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="gold" onClick={adicionar} disabled={loading}>Adicionar</Button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Mapeamentos ativos ({items.length})</h2>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum mapeamento cadastrado.</p>
        )}
        {items.map((m) => (
          <div key={m.id} className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-center border-t border-border pt-3 first:border-0 first:pt-0">
            <div>
              <div className="text-xs text-muted-foreground">Form ID</div>
              <div className="font-mono text-sm">{m.form_id}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nome</div>
              <div className="text-sm">{m.nome}</div>
            </div>
            <Select value={m.regiao} onValueChange={(v) => atualizar(m.id, { regiao: v as LeadRegiao })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={m.canal} onValueChange={(v) => atualizar(m.id, { canal: v as LeadCanal })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={m.ativo} onCheckedChange={(v) => atualizar(m.id, { ativo: v })} />
              <span className="text-xs text-muted-foreground">{m.ativo ? "Ativo" : "Pausado"}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remover(m.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}


function GoogleConnectSection() {
  const startOAuth = useServerFn(startGoogleOAuth);
  const status = useServerFn(getGoogleStatus);
  const disconnect = useServerFn(disconnectGoogle);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const s = await status();
      setConnected(s.connected);
      setEmail(s.email);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== "google-oauth") return;
      if (d.status === "connected") {
        toast.success("Google conectado");
        refresh();
      } else {
        toast.error(`Falha ao conectar: ${d.reason ?? "erro"}`);
      }
      setBusy(false);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function handleConnect() {
    setBusy(true);
    try {
      const { url } = await startOAuth();
      const w = window.open(url, "google-oauth", "width=520,height=640,menubar=no,toolbar=no");
      if (!w) {
        toast.error("Permita pop-ups para conectar o Google");
        setBusy(false);
        return;
      }
      const timer = setInterval(() => {
        if (w.closed) { clearInterval(timer); setBusy(false); refresh(); }
      }, 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar conexão");
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar sua conta Google?")) return;
    setBusy(true);
    try {
      await disconnect();
      toast.success("Conta Google desconectada");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 max-w-md space-y-3">
      <div>
        <h2 className="font-semibold">Google Calendar / Meet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte sua conta Google para gerar links do Google Meet automaticamente nas reuniões.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">Conectado</div>
            {email && <div className="text-muted-foreground text-xs">{email}</div>}
          </div>
          <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
            Desconectar
          </Button>
        </div>
      ) : (
        <Button variant="gold" onClick={handleConnect} disabled={busy}>
          {busy ? "Conectando..." : "Conectar Google"}
        </Button>
      )}
    </section>
  );
}
