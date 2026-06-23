import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Loader2, ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { DocumentosManager } from "@/components/admin/DocumentosManager";
import { FotosManager, FotosThumbs } from "@/components/admin/FotosManager";
import { ImoveisImportExport } from "@/components/admin/ImoveisImportExport";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useServerFn } from "@tanstack/react-start";
import { importImovelFromUrl } from "@/lib/imovel-import.functions";
import { notifyImovelDisponivelNovamente } from "@/lib/imoveis-notify.functions";

type Imovel = Database["public"]["Tables"]["imoveis"]["Row"];
type ImovelInsert = Database["public"]["Tables"]["imoveis"]["Insert"];

/** Campo de moeda BRL: usuário digita números; formata como R$ 1.500,00 */
function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  const format = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const display = value == null || Number.isNaN(value) ? "" : format(Number(value));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        className="pl-10"
        placeholder={placeholder ?? "0,00"}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (!digits) {
            onChange(null);
            return;
          }
          onChange(Number(digits) / 100);
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/imoveis")({
  component: ImoveisPage,
});

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível", // legado
  disponivel_locacao: "Disponível p/ Locação",
  disponivel_venda: "Disponível p/ Venda",
  locado: "Locado",
  vendido: "Vendido",
  manutencao: "Em manutenção",
  rescindido: "Rescindido",
};
const STATUS_COLOR: Record<string, string> = {
  disponivel: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  disponivel_locacao: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  disponivel_venda: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  locado: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  vendido: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  manutencao: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  rescindido: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const FINALIDADE_LABEL: Record<string, string> = {
  locacao: "Locação",
  venda: "Venda",
  ambos: "Locação e Venda",
};

function formatBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

function ImoveisPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Imovel | null>(null);
  const [open, setOpen] = useState(false);
  const [finalidadeFiltro, setFinalidadeFiltro] = useState<"todos" | "locacao" | "venda" | "ambos">("todos");
  const [tab, setTab] = useState<"todos" | "alugados" | "venda" | "vendidos" | "proprietarios">("todos");
  const [busca, setBusca] = useState("");

  const { data: imoveis = [], isLoading } = useQuery({
    queryKey: ["imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("imoveis").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Imovel[];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles-nomes"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").eq("ativo", true);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.nome ?? "—"; });
      return map;
    },
  });

  const byFinalidade = imoveis.filter((i) => {
    if (finalidadeFiltro === "todos") return true;
    const fin = ((i as unknown as { finalidade?: string }).finalidade) ?? "locacao";
    return fin === finalidadeFiltro;
  });

  const byBusca = byFinalidade.filter((i) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const loc = (i as unknown as { locatario_nome?: string | null }).locatario_nome ?? "";
    return (i.proprietario_nome ?? "").toLowerCase().includes(q) || loc.toLowerCase().includes(q);
  });

  const filtered = byBusca.filter((i) => {
    if (tab === "alugados") return i.status === "locado";
    if (tab === "vendidos") return i.status === "vendido";
    if (tab === "venda") {
      const fin = ((i as unknown as { finalidade?: string }).finalidade) ?? "locacao";
      return (fin === "venda" || fin === "ambos") && i.status !== "vendido" && i.status !== "locado";
    }
    return true;
  });

  // Aggregate proprietários
  const proprietarios = Array.from(
    byBusca.reduce((m, i) => {
      const key = (i.proprietario_nome ?? "—").trim();
      const cur = m.get(key) ?? { nome: key, documento: i.proprietario_documento, telefone: i.proprietario_telefone, email: i.proprietario_email, imoveis: [] as Imovel[] };
      cur.imoveis.push(i);
      m.set(key, cur);
      return m;
    }, new Map<string, { nome: string; documento: string | null; telefone: string | null; email: string | null; imoveis: Imovel[] }>()).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(i: Imovel) { setEditing(i); setOpen(true); }

  async function remove(id: string) {
    if (!confirm("Excluir este imóvel? Contratos vinculados também serão removidos.")) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Imóvel excluído");
    qc.invalidateQueries({ queryKey: ["imoveis"] });
  }

  const renderCards = (list: Imovel[]) => (
    list.length === 0 ? (
      <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum imóvel encontrado.</CardContent></Card>
    ) : (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((i) => {
          const fin = ((i as unknown as { finalidade?: string }).finalidade) ?? "locacao";
          const valorVenda = (i as unknown as { valor_venda?: number | null }).valor_venda ?? null;
          return (
          <Card key={i.id} className="cursor-pointer hover:border-gold/50 transition" onClick={() => openEdit(i)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">
                    {(i as unknown as { locatario_nome?: string | null }).locatario_nome || <span className="capitalize">{i.tipo}</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">{i.tipo}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{(i as unknown as { codigo?: string }).codigo ?? "—"}</div>
                </div>
                <Badge className={STATUS_COLOR[i.status]}>{STATUS_LABEL[i.status] ?? i.status}</Badge>
              </div>
              {i.fotos && i.fotos.length > 0 && <FotosThumbs fotos={i.fotos} />}
              <div className="text-xs text-muted-foreground">Finalidade: {FINALIDADE_LABEL[fin] ?? fin}</div>
              <div className="text-sm text-muted-foreground">
                {i.rua}{i.numero ? `, ${i.numero}` : ""}{i.bairro ? ` — ${i.bairro}` : ""}{i.cidade ? ` / ${i.cidade}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">Proprietário: {i.proprietario_nome}</div>
              {(i as unknown as { captador_id?: string | null }).captador_id && (
                <div className="text-xs text-muted-foreground">
                  Captador: {profilesMap[(i as unknown as { captador_id: string }).captador_id] ?? "—"}
                </div>
              )}
              {(i as unknown as { gestao_patrimonio?: boolean }).gestao_patrimonio && (
                <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">Gestão de Patrimônio</Badge>
              )}
              {(i as unknown as { dia_vencimento?: number | null }).dia_vencimento != null && (
                <div className="text-xs text-muted-foreground">Vencimento: dia {(i as unknown as { dia_vencimento?: number | null }).dia_vencimento}</div>
              )}
              {(i as unknown as { vitrine_url?: string | null }).vitrine_url && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1 text-xs border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={(i as unknown as { vitrine_url?: string | null }).vitrine_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Vitrine
                  </a>
                </Button>
              )}


              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex flex-col">
                  {(fin === "locacao" || fin === "ambos") && (
                    <span className="font-bold text-gold text-sm">Aluguel: {formatBRL(i.valor_aluguel)}</span>
                  )}
                  {(fin === "venda" || fin === "ambos") && valorVenda != null && (
                    <span className="font-bold text-gold text-sm">Venda: {formatBRL(valorVenda)}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(i); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(i.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );})}
      </div>
    )
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:flex md:justify-between md:items-center md:flex-wrap">
        <div className="text-sm text-muted-foreground">{filtered.length} imóve{filtered.length === 1 ? "l" : "is"}</div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
          <Input
            placeholder="Buscar por locatário ou proprietário..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full sm:w-[260px]"
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Finalidade:</Label>
            <Select value={finalidadeFiltro} onValueChange={(v) => setFinalidadeFiltro(v as never)}>
              <SelectTrigger className="h-10 w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="ambos">Locação e Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <ImoveisImportExport
              imoveis={filtered as unknown as Record<string, unknown>[]}
              onImported={() => qc.invalidateQueries({ queryKey: ["imoveis"] })}
            />
            <Button onClick={openNew} className="flex-1 sm:flex-none"><Plus className="h-4 w-4 mr-1" /> Novo Imóvel</Button>
          </div>
        </div>
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="alugados">Alugados</TabsTrigger>
          <TabsTrigger value="venda">À Venda</TabsTrigger>
          <TabsTrigger value="vendidos">Vendidos</TabsTrigger>
          <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : renderCards(filtered)}
        </TabsContent>
        <TabsContent value="alugados" className="mt-4">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : renderCards(filtered)}
        </TabsContent>
        <TabsContent value="venda" className="mt-4">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : renderCards(filtered)}
        </TabsContent>
        <TabsContent value="vendidos" className="mt-4">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> : renderCards(filtered)}
        </TabsContent>
        <TabsContent value="proprietarios" className="mt-4">
          {proprietarios.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum proprietário.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {proprietarios.map((p) => (
                <Card key={p.nome}>
                  <CardContent className="p-4 space-y-1">
                    <div className="font-semibold">{p.nome}</div>
                    {p.documento && <div className="text-xs text-muted-foreground">Doc: {p.documento}</div>}
                    {p.telefone && <div className="text-xs text-muted-foreground">Tel: {p.telefone}</div>}
                    {p.email && <div className="text-xs text-muted-foreground">Email: {p.email}</div>}
                    <div className="pt-2 border-t mt-2">
                      <div className="text-xs text-muted-foreground mb-1">{p.imoveis.length} imóve{p.imoveis.length === 1 ? "l" : "is"}</div>
                      <div className="space-y-1">
                        {p.imoveis.map((i) => (
                          <button key={i.id} onClick={() => openEdit(i)} className="block text-left w-full text-xs hover:text-gold">
                            <span className="font-mono">{(i as unknown as { codigo?: string }).codigo ?? "—"}</span>
                            {" — "}{i.rua}{i.numero ? `, ${i.numero}` : ""}
                            {" "}<Badge variant="outline" className="ml-1 text-[10px]">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ImovelDialog open={open} onOpenChange={setOpen} imovel={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["imoveis"] })} />
    </div>
  );
}

function ImovelDialog({ open, onOpenChange, imovel, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; imovel: Imovel | null; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ImovelInsert>>({});
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const importFn = useServerFn(importImovelFromUrl);
  const notifyDisponivel = useServerFn(notifyImovelDisponivelNovamente);

  async function handleImport() {
    const url = importUrl.trim();
    if (!url) { toast.error("Cole a URL do imóvel"); return; }
    setImporting(true);
    try {
      const res = await importFn({ data: { url } });
      if (!res.ok) {
        toast.warning(res.warning ?? "Não consegui extrair dados — preencha manualmente.");
        return;
      }
      const d = res.data;
      setForm((f) => {
        const next: Partial<ImovelInsert> = { ...f };
        if (d.codigo) (next as any).codigo = d.codigo;
        if (d.tipo) next.tipo = d.tipo;
        if (d.finalidade) (next as any).finalidade = d.finalidade;
        if (d.status) next.status = d.status as any;
        if (d.bairro) next.bairro = d.bairro;
        if (d.cidade) next.cidade = d.cidade;
        if (d.valor_venda != null) (next as any).valor_venda = d.valor_venda;
        if (d.valor_aluguel != null) next.valor_aluguel = d.valor_aluguel;
        if (d.condominio != null) next.condominio = d.condominio;
        if (d.iptu != null) next.iptu = d.iptu;
        if (d.quartos != null) next.quartos = d.quartos;
        if (d.banheiros != null) next.banheiros = d.banheiros;
        if (d.vagas != null) next.vagas = d.vagas;
        if (d.area_m2 != null) next.area_m2 = d.area_m2 as any;
        if (d.descricao) next.observacoes = d.descricao;
        if (d.fotos.length) {
          const existing = new Set(f.fotos ?? []);
          const merged = [...(f.fotos ?? [])];
          for (const u of d.fotos) if (!existing.has(u)) merged.push(u);
          next.fotos = merged;
        }
        if (d.latitude != null) (next as any).latitude = d.latitude;
        if (d.longitude != null) (next as any).longitude = d.longitude;
        return next;
      });
      toast.success(
        `Dados importados${d.fotos.length ? ` — ${d.fotos.length} foto(s) baixada(s) e salva(s)` : ""}. Revise antes de salvar.`
      );
      if (res.warning) toast.warning(res.warning);
    } catch (e) {
      console.error("[importImovel]", e);
      toast.error("Não consegui extrair os dados automaticamente — preencha manualmente.");
    } finally {
      setImporting(false);
    }
  }

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores_fechamento"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["corretor", "corretor_vendas"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [] as Array<{ id: string; nome: string; responsavel_id: string | null }>;
      const { data: profs } = await supabase.from("profiles").select("id, nome, responsavel_id").in("id", ids).order("nome");
      return (profs ?? []) as Array<{ id: string; nome: string; responsavel_id: string | null }>;
    },
    enabled: open,
  });

  const { data: captadores = [] } = useQuery({
    queryKey: ["captadores"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["corretor", "corretor_vendas", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [] as Array<{ id: string; nome: string }>;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids)
        .eq("ativo", true)
        .order("nome");
      return (profs ?? []) as Array<{ id: string; nome: string }>;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (imovel) {
      setForm({ ...imovel });
      return;
    }
    // Preview do próximo código sequencial (IM-XXXX). Pode ser editado antes de salvar.
    (async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("codigo")
        .like("codigo", "IM-%")
        .order("codigo", { ascending: false })
        .limit(1);
      const last = (data?.[0]?.codigo ?? "IM-0000") as string;
      const n = parseInt(last.replace(/^IM-/, ""), 10) || 0;
      const next = `IM-${String(n + 1).padStart(4, "0")}`;
      setForm({
        tipo: "apartamento", status: "disponivel_locacao", finalidade: "locacao" as never,
        valor_aluguel: 0, iptu: 0, condominio: 0,
        quartos: 0, banheiros: 0, vagas: 0, rua: "", proprietario_nome: "",
        codigo: next as never,
      });
    })();
  }, [open, imovel]);


  const finalidade = ((form as { finalidade?: string }).finalidade) ?? "locacao";
  const showAluguel = finalidade === "locacao" || finalidade === "ambos";
  const showVenda = finalidade === "venda" || finalidade === "ambos";
  const showLocatario = showAluguel;

  function set<K extends keyof ImovelInsert>(k: K, v: ImovelInsert[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setCorretor(corretorId: string) {
    const c = corretores.find((x) => x.id === corretorId);
    setForm((f) => ({
      ...f,
      corretor_fechamento_id: corretorId || null,
      executivo_fechamento_id: c?.responsavel_id ?? null,
    } as unknown as Partial<ImovelInsert>));
  }

  async function save() {
    if (!form.rua || !form.proprietario_nome || !form.tipo) {
      toast.error("Preencha tipo, rua e proprietário");
      return;
    }
    setSaving(true);
    const { data: ud } = await supabase.auth.getUser();
    // Strip server-managed fields that should not be sent on insert/update
    const { id: _id, created_at: _ca, updated_at: _ua, ...clean } = form as Record<string, unknown>;
    void _id; void _ca; void _ua;
    const payload = { ...clean, created_by: imovel?.created_by ?? ud.user?.id } as ImovelInsert;
    const q = imovel
      ? supabase.from("imoveis").update(payload).eq("id", imovel.id)
      : supabase.from("imoveis").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      console.error("[imoveis save]", error, payload);
      toast.error(error.message || "Erro ao salvar imóvel");
      return;
    }
    toast.success(imovel ? "Imóvel atualizado" : "Imóvel cadastrado");
    onOpenChange(false);
    setForm({});
    onSaved();
  }


  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setForm({}); setImportUrl(""); } }}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {imovel ? "Editar Imóvel" : "Novo Imóvel"}
            {imovel && (form as { codigo?: string }).codigo && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {(form as { codigo?: string }).codigo}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {!imovel && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" /> Importar do site (Voa Corretor)
            </Label>
            <p className="text-xs text-muted-foreground">
              Cole a URL pública do imóvel (ex.: https://www.iurirodriguesimoveis.com.br/imovel/.../AP0021)
              e clique em <strong>Buscar dados</strong>. Os campos serão preenchidos automaticamente — revise antes de salvar.
            </p>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://www.iurirodriguesimoveis.com.br/imovel/..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={importing}
              />
              <Button type="button" onClick={handleImport} disabled={importing || !importUrl.trim()}>
                {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {importing ? "Buscando..." : "Buscar dados"}
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-1 max-w-xs">
          <Label>Código do Imóvel {imovel ? "" : "(gerado automaticamente — pode editar)"}</Label>
          <Input
            value={(form as { codigo?: string }).codigo ?? ""}
            onChange={(e) => set("codigo" as never, e.target.value as never)}
            placeholder="IM-0001"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo ?? "apartamento"} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Finalidade *</Label>
            <Select
              value={finalidade}
              onValueChange={(v) => set("finalidade" as never, v as never)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="ambos">Locação e Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "disponivel_locacao"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL)
                  .filter(([k]) => k !== "disponivel" || form.status === "disponivel")
                  .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.status === "vendido" && (
            <div>
              <Label>Data da venda</Label>
              <Input type="date" value={(form as any).data_venda ?? ""} onChange={(e) => set("data_venda" as any, e.target.value || null as any)} />
            </div>
          )}
          {form.status === "locado" && (
            <div>
              <Label>Data da locação</Label>
              <Input type="date" value={(form as any).data_locacao ?? ""} onChange={(e) => set("data_locacao" as any, e.target.value || null as any)} />
            </div>
          )}
          {(form.status === "vendido" || form.status === "locado") && (
            <>
              <div>
                <Label>Corretor responsável pelo fechamento</Label>
                <Select value={(form as any).corretor_fechamento_id ?? ""} onValueChange={setCorretor}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Executivo / equipe</Label>
                <ExecutivoLabel id={(form as any).executivo_fechamento_id ?? null} />
              </div>
            </>
          )}
          <div className="md:col-span-2"><Label>Rua *</Label><Input value={form.rua ?? ""} onChange={(e) => set("rua", e.target.value)} /></div>
          <div><Label>Número</Label><Input value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} /></div>
          <div><Label>Complemento</Label><Input value={form.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} /></div>
          <div><Label>Bairro</Label><Input value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></div>
          <div><Label>CEP</Label><Input value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} /></div>

          <div className="md:col-span-2 border-t pt-3 mt-2"><h3 className="font-semibold text-sm">Proprietário</h3></div>
          <div><Label>Nome *</Label><Input value={form.proprietario_nome ?? ""} onChange={(e) => set("proprietario_nome", e.target.value)} /></div>
          <div><Label>CPF/CNPJ</Label><Input value={form.proprietario_documento ?? ""} onChange={(e) => set("proprietario_documento", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={form.proprietario_telefone ?? ""} onChange={(e) => set("proprietario_telefone", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.proprietario_email ?? ""} onChange={(e) => set("proprietario_email", e.target.value)} /></div>

          {showLocatario && (
            <>
              <div className="md:col-span-2 border-t pt-3 mt-2"><h3 className="font-semibold text-sm">Locatário (quem está alugando)</h3></div>
              <div><Label>Nome</Label><Input value={(form as any).locatario_nome ?? ""} onChange={(e) => set("locatario_nome" as any, e.target.value as any)} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={(form as any).locatario_documento ?? ""} onChange={(e) => set("locatario_documento" as any, e.target.value as any)} /></div>
              <div><Label>Telefone</Label><Input value={(form as any).locatario_telefone ?? ""} onChange={(e) => set("locatario_telefone" as any, e.target.value as any)} /></div>
              <div><Label>Email</Label><Input type="email" value={(form as any).locatario_email ?? ""} onChange={(e) => set("locatario_email" as any, e.target.value as any)} /></div>
              <div><Label>Dia do Vencimento do Aluguel</Label><Input type="number" min={1} max={31} value={(form as any).dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento" as any, (e.target.value ? Number(e.target.value) : null) as any)} /></div>
            </>
          )}



          <div className="md:col-span-2 border-t pt-3 mt-2"><h3 className="font-semibold text-sm">Valores e características</h3></div>
          {showAluguel && (
            <div><Label>Valor do Aluguel (R$)</Label><CurrencyInput value={form.valor_aluguel ?? null} onChange={(v) => set("valor_aluguel", (v ?? 0) as never)} /></div>
          )}
          {showVenda && (
            <div><Label>Valor de Venda (R$)</Label><CurrencyInput value={(form as any).valor_venda ?? null} onChange={(v) => set("valor_venda" as any, v as never)} /></div>
          )}
          <div><Label>IPTU mensal (R$)</Label><CurrencyInput value={form.iptu ?? null} onChange={(v) => set("iptu", (v ?? 0) as never)} /></div>
          <div><Label>Condomínio (R$)</Label><CurrencyInput value={form.condominio ?? null} onChange={(v) => set("condominio", (v ?? 0) as never)} /></div>
          <div><Label>Área (m²)</Label><Input type="number" step="0.01" value={form.area_m2 ?? ""} onChange={(e) => set("area_m2", e.target.value ? Number(e.target.value) : null)} /></div>
          <div><Label>Quartos</Label><Input type="number" value={form.quartos ?? 0} onChange={(e) => set("quartos", Number(e.target.value))} /></div>
          <div><Label>Banheiros</Label><Input type="number" value={form.banheiros ?? 0} onChange={(e) => set("banheiros", Number(e.target.value))} /></div>
          <div><Label>Vagas</Label><Input type="number" value={form.vagas ?? 0} onChange={(e) => set("vagas", Number(e.target.value))} /></div>
          <div>
            <Label>Garantia</Label>
            <Select value={form.garantia ?? ""} onValueChange={(v) => set("garantia", v || null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fiador">Fiador</SelectItem>
                <SelectItem value="caucao">Caução</SelectItem>
                <SelectItem value="seguro">Seguro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 border-t pt-3 mt-2">
            <Label className="text-sm font-semibold">Link da Vitrine (Bom Corretor)</Label>
            <p className="text-xs text-muted-foreground mb-2">Cole o link público do imóvel no Bom Corretor (ou outro portal).</p>
            <Input
              type="url"
              placeholder="https://bomcorretor.com.br/imovel/..."
              value={(form as any).vitrine_url ?? ""}
              onChange={(e) => set("vitrine_url" as any, (e.target.value || null) as any)}
            />
          </div>
          <div className="md:col-span-2 border-t pt-3 mt-2">
            <Label className="text-sm font-semibold">Fotos do Imóvel</Label>
            <p className="text-xs text-muted-foreground mb-2">Adicione, remova e reordene as fotos. Aparecem no card e no detalhe.</p>
            <FotosManager
              fotos={form.fotos ?? []}
              onChange={(next) => set("fotos", next)}
              imovelId={imovel?.id}
            />
          </div>
          <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        {imovel && (
          <div className="border-t pt-4 mt-2 space-y-3">
            <h3 className="font-semibold text-sm">Documentos do imóvel (Google Drive)</h3>
            <DocumentosManager imovelId={imovel.id} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutivoLabel({ id }: { id: string | null }) {
  const { data } = useQuery({
    queryKey: ["responsavel", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from("responsaveis").select("nome").eq("id", id).maybeSingle();
      return data?.nome ?? null;
    },
    enabled: !!id,
  });
  return <Input readOnly value={id ? (data ?? "Carregando...") : "—"} placeholder="Preenchido automaticamente" />;
}
