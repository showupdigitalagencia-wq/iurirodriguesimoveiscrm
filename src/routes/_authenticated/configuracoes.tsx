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
import { getVslUrl, setVslUrl, setVslAllowSkip } from "@/lib/candidatos.functions";
import {
  getCaptacaoConfig,
  setCaptacaoVslUrl,
  uploadCaptacaoTeamPhoto,
  updateCaptacaoTeamMeta,
  removeCaptacaoTeamPhoto,
  uploadCaptacaoGroupPhoto,
  removeCaptacaoGroupPhoto,
  uploadCaptacaoExecutivoPhoto,
  removeCaptacaoExecutivoPhoto,
} from "@/lib/captacao.functions";
import { CAPTACAO_EXECUTIVOS } from "@/lib/captacao.constants";
import { exportSistemaZip } from "@/lib/export-sistema.functions";
import { listarBackups, gerarUrlBackup, rodarBackupManual } from "@/lib/backups.functions";
import { Download, Archive, RefreshCcw } from "lucide-react";
import { FotoPerfilSection } from "@/components/foto-perfil-section";
import { listResponsaveisWhatsapp, updateResponsavelWhatsapp } from "@/lib/responsaveis-admin.functions";

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
    return <div className="p-6 md:p-8 text-muted-foreground">Carregando...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-4xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua conta.</p>
        </header>
        <FotoPerfilSection />
        <MinhaContaSection />
        <GoogleConnectSection />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
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
          <FotoPerfilSection />
          <MinhaContaSection />
          <GoogleConnectSection />
          <MensagemTemplatesSection />
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
          <VslUrlSection />
          <VslCaptacaoSection />
          <GroupPhotoSection />
          <ExecutivoPhotosSection />
          <TeamPhotosSection />
          <ReativacaoLeadsConfig />
          <FollowupLeadsConfig />
          <ExportSistemaSection />
          <BackupsSection />
          <VisitaChecklistConfig />
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
            Quando ativado, o menu <strong>Gestão Patrimonial</strong> (imóveis, contratos e locações) fica visível para administradores e usuários com perfil <strong>Administrativo</strong>.
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


function ReativacaoLeadsConfig() {
  const [dias, setDias] = useState<number | "">("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", "lead_reativacao_dias").maybeSingle()
      .then(({ data }) => {
        const v = data?.valor;
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 60;
        setDias(Number.isFinite(n) && n > 0 ? n : 60);
        setLoaded(true);
      });
  }, []);

  async function salvar() {
    if (typeof dias !== "number" || !Number.isFinite(dias) || dias < 1 || dias > 365) {
      toast.error("Informe entre 1 e 365 dias");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("configuracoes")
      .upsert({ chave: "lead_reativacao_dias", valor: dias as never, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(`Reativação configurada para ${dias} dias`);
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div>
        <h3 className="font-semibold">♻️ Reativação de leads perdidos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define quantos dias após um lead ser marcado como <strong>perdido/descartado</strong> o sistema sugere reativá-lo por push ao corretor/responsável. A varredura roda automaticamente todo dia às 9h.
        </p>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[180px]">
          <Label className="text-xs">Dias para sugerir reativação</Label>
          <Input
            type="number" min={1} max={365}
            value={dias}
            disabled={!loaded || saving}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDias(Number.isFinite(n) ? n : "");
            }}
          />
        </div>
        <Button onClick={salvar} disabled={!loaded || saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}


const VENDAS_ETAPAS: Array<{ key: string; label: string; def: number }> = [
  { key: "novo_lead", label: "Novo Lead", def: 1 },
  { key: "contato_realizado", label: "Contato Realizado", def: 3 },
  { key: "visita_agendada", label: "Visita Agendada", def: 2 },
  { key: "proposta_enviada", label: "Proposta Enviada", def: 4 },
  { key: "em_negociacao", label: "Negociação", def: 5 },
  { key: "follow_up", label: "Follow Up", def: 3 },
];

const CAPTACAO_ETAPAS: Array<{ key: string; label: string; def: number }> = [
  { key: "novos_leads", label: "Novo Lead", def: 1 },
  { key: "em_atendimento", label: "Contato Realizado", def: 3 },
  { key: "reuniao_agendada", label: "Reunião Agendada", def: 2 },
  { key: "solicitacao_documentos", label: "Solicitação de Documentos", def: 5 },
  { key: "documentos_enviados", label: "Documentos Enviados", def: 4 },
  { key: "em_negociacao", label: "Em Negociação", def: 5 },
  { key: "follow_up", label: "Follow Up", def: 3 },
];

function parseDiasMap(raw: unknown, etapas: Array<{ key: string; def: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of etapas) out[e.key] = e.def;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
  }
  return out;
}

function FollowupPipelineConfig({
  titulo,
  descricao,
  chave,
  etapas,
}: {
  titulo: string;
  descricao: string;
  chave: string;
  etapas: Array<{ key: string; label: string; def: number }>;
}) {
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(etapas.map((e) => [e.key, e.def])),
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle()
      .then(({ data }) => {
        setValores(parseDiasMap(data?.valor, etapas));
        setLoaded(true);
      });
  }, [chave]);

  async function salvar() {
    for (const e of etapas) {
      const v = valores[e.key];
      if (!Number.isFinite(v) || v < 1 || v > 90) {
        toast.error(`"${e.label}" deve estar entre 1 e 90 dias`);
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("configuracoes")
      .upsert({ chave, valor: valores as never, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva");
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div>
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {etapas.map((e) => (
          <div key={e.key}>
            <Label className="text-xs">{e.label}</Label>
            <Input
              type="number" min={1} max={90}
              value={valores[e.key] ?? ""}
              disabled={!loaded || saving}
              onChange={(ev) => {
                const n = Number(ev.target.value);
                setValores((prev) => ({ ...prev, [e.key]: Number.isFinite(n) ? n : 0 }));
              }}
            />
          </div>
        ))}
      </div>
      <Button onClick={salvar} disabled={!loaded || saving}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}

function FollowupLeadsConfig() {
  return (
    <div className="space-y-4">
      <FollowupPipelineConfig
        titulo="⏰ Alerta de follow-up — Pipeline de Vendas"
        descricao="Dias sem interação por etapa que disparam push ao corretor/executivo responsável pelo lead. Não repete até o lead receber nova atualização. Varredura diária às 10h."
        chave="lead_followup_dias_vendas"
        etapas={VENDAS_ETAPAS}
      />
      <FollowupPipelineConfig
        titulo="⏰ Alerta de follow-up — Pipeline de Captação"
        descricao="Dias sem interação por etapa que disparam push ao Executivo responsável pela região do lead. Não se aplica a Fechado, Descartado ou Descredenciado."
        chave="lead_followup_dias_captacao"
        etapas={CAPTACAO_ETAPAS}
      />
    </div>
  );
}




function ExportSistemaSection() {
  const exportar = useServerFn(exportSistemaZip);
  const [loading, setLoading] = useState(false);
  const [ultimoResumo, setUltimoResumo] = useState<Record<string, number> | null>(null);

  async function baixar() {
    setLoading(true);
    try {
      const res = await exportar();
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setUltimoResumo(res.resumo);
      toast.success(`Exportação concluída (${(res.tamanho / 1024).toFixed(1)} KB)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div>
        <h3 className="font-semibold">📦 Exportação de dados do sistema</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gera um arquivo ZIP com CSVs de leads (captação e vendas), imóveis, contratos, financiamentos e candidatos. Apenas campos estruturados — documentos, fotos e URLs de storage <strong>não</strong> são incluídos. A ação fica registrada no log de auditoria.
        </p>
      </div>
      <Button onClick={baixar} disabled={loading} className="gap-2">
        <Download className="h-4 w-4" />
        {loading ? "Gerando ZIP..." : "Exportar dados do sistema"}
      </Button>
      {ultimoResumo && (
        <div className="text-xs text-muted-foreground border-t pt-3 mt-2">
          <strong>Última exportação:</strong>{" "}
          {Object.entries(ultimoResumo).map(([t, n]) => `${t}: ${n}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function BackupsSection() {
  const listar = useServerFn(listarBackups);
  const gerarUrl = useServerFn(gerarUrlBackup);
  const rodar = useServerFn(rodarBackupManual);
  const [items, setItems] = useState<Array<{ nome: string; data: string; tamanho_bytes: number; criado_em: string | null }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [rodando, setRodando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const res = await listar();
      setItems(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao listar backups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function baixar(nome: string) {
    try {
      const { url } = await gerarUrl({ data: { nome } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar URL");
    }
  }

  async function rodarAgora() {
    setRodando(true);
    try {
      const res = await rodar();
      toast.success(`Backup gerado: ${res.arquivo} (${(res.tamanho_bytes / 1024).toFixed(1)} KB)`);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao rodar backup");
    } finally {
      setRodando(false);
    }
  }

  function fmtTamanho(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Archive className="h-4 w-4" /> Backups automáticos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gerados automaticamente toda segunda-feira (09:00 UTC) e mantidos por 8 semanas. Os arquivos ficam num bucket privado; o download usa URL temporária de 5 minutos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={rodarAgora} disabled={rodando} className="gap-2 shrink-0">
          <RefreshCcw className={`h-4 w-4 ${rodando ? "animate-spin" : ""}`} />
          {rodando ? "Gerando..." : "Rodar agora"}
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}
      {!loading && items && items.length === 0 && (
        <div className="text-sm text-muted-foreground border-t pt-3">
          Nenhum backup gerado ainda. O primeiro será criado na próxima segunda-feira ou clique em "Rodar agora".
        </div>
      )}
      {items && items.length > 0 && (
        <div className="border-t pt-3 space-y-1">
          {items.map((it) => (
            <div key={it.nome} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <div>
                <div className="font-medium">{it.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {it.data} · {fmtTamanho(it.tamanho_bytes)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => baixar(it.nome)} className="gap-2">
                <Download className="h-4 w-4" /> Baixar
              </Button>
            </div>
          ))}
        </div>
      )}
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
  const listResp = useServerFn(listResponsaveisWhatsapp);
  const updateResp = useServerFn(updateResponsavelWhatsapp);

  useEffect(() => {
    listResp({} as never)
      .then((data: unknown) => setResps((data as Resp[]) ?? []))
      .catch((e: Error) => toast.error(e.message));
  }, [listResp]);

  async function save(r: Resp) {
    setSaving(r.id);
    try {
      await updateResp({ data: { id: r.id, nome: r.nome, whatsapp: r.whatsapp } });
      toast.success("Salvo");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
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

function VslUrlSection() {
  const fnGet = useServerFn(getVslUrl);
  const fnSet = useServerFn(setVslUrl);
  const fnSetSkip = useServerFn(setVslAllowSkip);
  const [url, setUrl] = useState("");
  const [allowSkip, setAllowSkip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSkip, setSavingSkip] = useState(false);

  useEffect(() => {
    fnGet({})
      .then((r) => {
        setUrl(r.url ?? "");
        setAllowSkip(!!r.allowSkip);
      })
      .finally(() => setLoading(false));
  }, [fnGet]);

  async function save() {
    setSaving(true);
    try {
      await fnSet({ data: { url } });
      toast.success("Link VSL salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSkip(next: boolean) {
    setSavingSkip(true);
    const prev = allowSkip;
    setAllowSkip(next);
    try {
      await fnSetSkip({ data: { allowSkip: next } });
      toast.success(next ? "Pular vídeo liberado" : "Pular vídeo desativado");
    } catch (e) {
      setAllowSkip(prev);
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingSkip(false);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Link do vídeo VSL (Landing Page /cadastro)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cole o link do YouTube. Aparece em destaque na LP pública de captação.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          className="flex-1 min-w-[240px]"
        />
        <Button onClick={save} disabled={saving || loading} variant="gold">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <div className="flex items-start justify-between gap-4 pt-2 border-t">
        <div>
          <Label className="font-medium">Permitir pular o vídeo</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Quando ativado, exibe um botão discreto "Pular vídeo" para liberar o restante da página sem precisar assistir até o fim.
          </p>
        </div>
        <Switch checked={allowSkip} onCheckedChange={toggleSkip} disabled={loading || savingSkip} />
      </div>
    </div>
  );
}

// ============================================================
// VSL da Landing Page /seja-corretor (Captação de Corretores)
// ============================================================
function VslCaptacaoSection() {
  const fnGet = useServerFn(getCaptacaoConfig);
  const fnSet = useServerFn(setCaptacaoVslUrl);
  const [url, setUrlState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fnGet({})
      .then((r) => setUrlState(r.vslUrl ?? ""))
      .finally(() => setLoading(false));
  }, [fnGet]);

  async function save() {
    setSaving(true);
    try {
      await fnSet({ data: { url } });
      toast.success("Link VSL da captação salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Link do vídeo VSL — Captação de Corretores (/seja-corretor)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cole o link do YouTube com o vídeo institucional do Iuri para a LP pública de captação.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrlState(e.target.value)}
          disabled={loading}
          className="flex-1 min-w-[240px]"
        />
        <Button onClick={save} disabled={saving || loading} variant="gold">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Fotos do Time — LP /seja-corretor (até 4)
// ============================================================
type TeamSlot = { url: string | null; nome: string; cargo: string };

async function fileToB64(file: File): Promise<{ nome: string; mimeType: string; base64: string }> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return { nome: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(bin) };
}

function TeamPhotosSection() {
  const fnGet = useServerFn(getCaptacaoConfig);
  const fnUpload = useServerFn(uploadCaptacaoTeamPhoto);
  const fnUpdate = useServerFn(updateCaptacaoTeamMeta);
  const fnRemove = useServerFn(removeCaptacaoTeamPhoto);
  const [photos, setPhotos] = useState<TeamSlot[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { nome: string; cargo: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await fnGet({});
      setPhotos(r.photos as TeamSlot[]);
      const d: Record<number, { nome: string; cargo: string }> = {};
      r.photos.forEach((p, i) => (d[i] = { nome: p.nome, cargo: p.cargo }));
      setDrafts(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickFile(i: number, file: File) {
    setBusy(i);
    try {
      const arquivo = await fileToB64(file);
      const meta = drafts[i] ?? { nome: "", cargo: "" };
      await fnUpload({ data: { index: i, nome: meta.nome, cargo: meta.cargo, arquivo } });
      toast.success("Foto enviada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setBusy(null);
    }
  }

  async function saveMeta(i: number) {
    setBusy(i);
    try {
      const meta = drafts[i] ?? { nome: "", cargo: "" };
      await fnUpdate({ data: { index: i, nome: meta.nome, cargo: meta.cargo } });
      toast.success("Dados salvos");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  }

  async function remove(i: number) {
    if (!confirm("Remover esta foto?")) return;
    setBusy(i);
    try {
      await fnRemove({ data: { index: i } });
      toast.success("Foto removida");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Fotos do Time — LP /seja-corretor</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Até 4 fotos do time, exibidas na galeria da landing page de captação. JPG ou PNG, formato vertical (3:4) recomendado.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => {
            const p = photos[i];
            const draft = drafts[i] ?? { nome: "", cargo: "" };
            return (
              <div key={i} className="rounded-md border p-4 space-y-3 bg-muted/30">
                <div className="aspect-[3/4] w-full bg-muted rounded overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                  {p?.url ? (
                    <img src={p.url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    "Sem foto"
                  )}
                </div>
                <Input
                  placeholder="Nome"
                  value={draft.nome}
                  onChange={(e) => setDrafts((d) => ({ ...d, [i]: { ...draft, nome: e.target.value } }))}
                  maxLength={80}
                />
                <Input
                  placeholder="Cargo"
                  value={draft.cargo}
                  onChange={(e) => setDrafts((d) => ({ ...d, [i]: { ...draft, cargo: e.target.value } }))}
                  maxLength={80}
                />
                <div className="flex flex-wrap gap-2">
                  <Label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy === i}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickFile(i, f);
                        e.target.value = "";
                      }}
                    />
                    {p?.url ? "Trocar foto" : "Enviar foto"}
                  </Label>
                  <Button size="sm" variant="outline" disabled={busy === i} onClick={() => saveMeta(i)}>
                    Salvar dados
                  </Button>
                  {p?.url && (
                    <Button size="sm" variant="ghost" disabled={busy === i} onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VisitaChecklistConfig() {
  const [items, setItems] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "visita_checklist_items")
      .maybeSingle()
      .then(({ data }) => {
        const valor = (data?.valor ?? {}) as { items?: string[] };
        setItems(Array.isArray(valor.items) ? valor.items : []);
        setLoading(false);
      });
  }, []);

  async function persist(next: string[]) {
    setSaving(true);
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave: "visita_checklist_items", valor: { items: next } }, { onConflict: "chave" });
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    setItems(next);
    return true;
  }

  function addItem() {
    const v = novo.trim();
    if (!v) return;
    if (items.includes(v)) { toast.warning("Item já existe"); return; }
    persist([...items, v]).then((ok) => { if (ok) setNovo(""); });
  }

  function removeItem(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-6 space-y-3">
      <header>
        <h2 className="text-lg font-semibold">Checklist de Visita</h2>
        <p className="text-sm text-muted-foreground">
          Itens que o corretor marca ao confirmar uma visita como realizada.
        </p>
      </header>
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Ex.: Cliente assinou ficha de visita"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              disabled={saving}
            />
            <Button onClick={addItem} disabled={saving || !novo.trim()}>Adicionar</Button>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item configurado.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((it, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="text-sm">{it}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={saving} aria-label="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function MensagemTemplatesSection() {
  const [items, setItems] = useState<Array<{ id: string; titulo: string; conteudo: string; escopo: "pessoal" | "global"; owner_id: string | null }>>([]);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [escopo, setEscopo] = useState<"pessoal" | "global">("pessoal");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("mensagem_templates")
      .select("id, titulo, conteudo, escopo, owner_id")
      .order("escopo", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as typeof items);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: roleData } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        setIsAdmin(!!roleData);
      }
      await refresh();
      setLoading(false);
    })();
  }, []);

  async function adicionar() {
    const t = titulo.trim();
    const c = conteudo.trim();
    if (!t || !c) { toast.error("Preencha título e mensagem"); return; }
    if (t.length > 80) { toast.error("Título muito longo"); return; }
    if (c.length > 2000) { toast.error("Mensagem muito longa"); return; }
    setSaving(true);
    const { error } = await supabase.from("mensagem_templates").insert({
      titulo: t,
      conteudo: c,
      escopo,
      owner_id: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setTitulo(""); setConteudo(""); setEscopo("pessoal");
    toast.success("Template criado");
    refresh();
  }

  async function remover(id: string) {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("mensagem_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template excluído");
    refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-6 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Templates de WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Crie modelos de mensagem para enviar rapidamente aos leads. Use variáveis como{" "}
          <code className="text-[11px]">{"{primeiro_nome_lead}"}</code>,{" "}
          <code className="text-[11px]">{"{imovel_endereco}"}</code>,{" "}
          <code className="text-[11px]">{"{nome_corretor}"}</code>.
        </p>
      </header>

      <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
        <Input
          placeholder="Título (ex.: Primeiro contato)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          disabled={saving}
        />
        <textarea
          className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
          placeholder="Olá {primeiro_nome_lead}! Aqui é {nome_corretor} da imobiliária..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          maxLength={2000}
          disabled={saving}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {isAdmin ? (
            <Select value={escopo} onValueChange={(v) => setEscopo(v as "pessoal" | "global")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Pessoal (só eu)</SelectItem>
                <SelectItem value="global">Global (todos)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">Visível apenas para você</span>
          )}
          <Button onClick={adicionar} disabled={saving || !titulo.trim() || !conteudo.trim()}>
            Adicionar template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const podeRemover = it.escopo === "pessoal" ? it.owner_id === userId : isAdmin;
            return (
              <li key={it.id} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{it.titulo}</span>
                    <span className={`text-[10px] rounded px-1.5 py-0.5 border ${it.escopo === "global" ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                      {it.escopo === "global" ? "Global" : "Meu"}
                    </span>
                  </div>
                  {podeRemover && (
                    <Button variant="ghost" size="icon" onClick={() => remover(it.id)} aria-label="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{it.conteudo}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// Foto do grupo — LP /seja-corretor
// ============================================================
function GroupPhotoSection() {
  const fnGet = useServerFn(getCaptacaoConfig);
  const fnUpload = useServerFn(uploadCaptacaoGroupPhoto);
  const fnRemove = useServerFn(removeCaptacaoGroupPhoto);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await fnGet({});
      setUrl(r.groupUrl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function onPick(file: File) {
    setBusy(true);
    try {
      const arquivo = await fileToB64(file);
      await fnUpload({ data: { arquivo } });
      toast.success("Foto do grupo enviada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remover foto do grupo?")) return;
    setBusy(true);
    try {
      await fnRemove({});
      toast.success("Foto removida");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Foto da Equipe (grupo) — LP /seja-corretor</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Uma única foto de grupo exibida abaixo do botão &quot;Quero fazer parte&quot;. Formato horizontal (16:9) recomendado.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-3">
          <div className="aspect-[16/9] w-full max-w-2xl bg-muted rounded overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
            {url ? <img src={url} alt="Equipe" className="w-full h-full object-cover" /> : "Sem foto"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                  e.target.value = "";
                }}
              />
              {url ? "Trocar foto" : "Enviar foto"}
            </Label>
            {url && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Fotos dos Executivos — LP /seja-corretor (Robson, Fabíola, Renata, Denise)
// ============================================================
function ExecutivoPhotosSection() {
  const fnGet = useServerFn(getCaptacaoConfig);
  const fnUpload = useServerFn(uploadCaptacaoExecutivoPhoto);
  const fnRemove = useServerFn(removeCaptacaoExecutivoPhoto);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await fnGet({});
      setPhotos(r.execPhotos);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function onPick(ref: "barra" | "recreio" | "belford" | "mesquita", file: File) {
    setBusy(ref);
    try {
      const arquivo = await fileToB64(file);
      await fnUpload({ data: { ref, arquivo } });
      toast.success("Foto enviada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setBusy(null);
    }
  }

  async function remove(ref: "barra" | "recreio" | "belford" | "mesquita") {
    if (!confirm("Remover foto deste executivo?")) return;
    setBusy(ref);
    try {
      await fnRemove({ data: { ref } });
      toast.success("Foto removida");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Fotos dos Executivos — LP /seja-corretor</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Uma foto para cada executivo. A LP exibe a foto correta conforme o link <code>?ref=</code> usado. Formato quadrado recomendado.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CAPTACAO_EXECUTIVOS.map((exec) => {
            const url = photos[exec.ref] ?? null;
            return (
              <div key={exec.ref} className="rounded-md border p-3 space-y-2 bg-muted/30">
                <div className="aspect-square w-full bg-muted rounded-full overflow-hidden flex items-center justify-center text-xs text-muted-foreground mx-auto" style={{ maxWidth: 160 }}>
                  {url ? (
                    <img src={url} alt={exec.nome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-semibold">{exec.nome.split(/\s+/).slice(0, 2).map((s) => s[0]).join("")}</span>
                  )}
                </div>
                <div className="text-center text-sm font-medium">{exec.nome}</div>
                <div className="text-center text-xs text-muted-foreground">{exec.regiao}</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy === exec.ref}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPick(exec.ref, f);
                        e.target.value = "";
                      }}
                    />
                    {url ? "Trocar" : "Enviar"}
                  </Label>
                  {url && (
                    <Button size="sm" variant="ghost" disabled={busy === exec.ref} onClick={() => remove(exec.ref)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
