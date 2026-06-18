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
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { DocumentosManager } from "@/components/admin/DocumentosManager";
import { FotosManager, FotosThumbs } from "@/components/admin/FotosManager";

type Imovel = Database["public"]["Tables"]["imoveis"]["Row"];
type ImovelInsert = Database["public"]["Tables"]["imoveis"]["Insert"];

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

  const { data: imoveis = [], isLoading } = useQuery({
    queryKey: ["imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("imoveis").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Imovel[];
    },
  });

  const filtered = imoveis.filter((i) => {
    if (finalidadeFiltro === "todos") return true;
    const fin = ((i as unknown as { finalidade?: string }).finalidade) ?? "locacao";
    return fin === finalidadeFiltro;
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(i: Imovel) { setEditing(i); setOpen(true); }

  async function remove(id: string) {
    if (!confirm("Excluir este imóvel? Contratos vinculados também serão removidos.")) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Imóvel excluído");
    qc.invalidateQueries({ queryKey: ["imoveis"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">{filtered.length} imóve{filtered.length === 1 ? "l" : "is"}</div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Finalidade:</Label>
          <Select value={finalidadeFiltro} onValueChange={(v) => setFinalidadeFiltro(v as never)}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="locacao">Locação</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="ambos">Locação e Venda</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Imóvel</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum imóvel encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => {
            const fin = ((i as unknown as { finalidade?: string }).finalidade) ?? "locacao";
            const valorVenda = (i as unknown as { valor_venda?: number | null }).valor_venda ?? null;
            return (
            <Card key={i.id} className="cursor-pointer hover:border-gold/50 transition" onClick={() => openEdit(i)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold capitalize">{i.tipo}</div>
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
      )}

      <ImovelDialog open={open} onOpenChange={setOpen} imovel={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["imoveis"] })} />
    </div>
  );
}

function ImovelDialog({ open, onOpenChange, imovel, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; imovel: Imovel | null; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ImovelInsert>>({});

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

  useEffect(() => {
    if (!open) return;
    setForm(imovel ? { ...imovel } : {
      tipo: "apartamento", status: "disponivel_locacao", finalidade: "locacao" as never,
      valor_aluguel: 0, iptu: 0, condominio: 0,
      quartos: 0, banheiros: 0, vagas: 0, rua: "", proprietario_nome: "",
    });
  }, [open, imovel]);

  const finalidade = ((form as { finalidade?: string }).finalidade) ?? "locacao";
  const showAluguel = finalidade === "locacao" || finalidade === "ambos";
  const showVenda = finalidade === "venda" || finalidade === "ambos";

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
    const payload = { ...form, created_by: imovel?.created_by ?? ud.user?.id } as ImovelInsert;
    const q = imovel
      ? supabase.from("imoveis").update(payload).eq("id", imovel.id)
      : supabase.from("imoveis").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(imovel ? "Imóvel atualizado" : "Imóvel cadastrado");
    onOpenChange(false);
    setForm({});
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        {imovel && (
          <div className="grid gap-1 max-w-xs">
            <Label>Código do Imóvel</Label>
            <Input
              value={(form as { codigo?: string }).codigo ?? ""}
              onChange={(e) => set("codigo" as never, e.target.value as never)}
              placeholder="IM-0001"
            />
          </div>
        )}
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

          <div className="md:col-span-2 border-t pt-3 mt-2"><h3 className="font-semibold text-sm">Valores e características</h3></div>
          {showAluguel && (
            <div><Label>Valor do Aluguel (R$)</Label><Input type="number" step="0.01" value={form.valor_aluguel ?? 0} onChange={(e) => set("valor_aluguel", Number(e.target.value))} /></div>
          )}
          {showVenda && (
            <div><Label>Valor de Venda (R$)</Label><Input type="number" step="0.01" value={(form as any).valor_venda ?? ""} onChange={(e) => set("valor_venda" as any, (e.target.value ? Number(e.target.value) : null) as any)} /></div>
          )}
          <div><Label>IPTU mensal (R$)</Label><Input type="number" step="0.01" value={form.iptu ?? 0} onChange={(e) => set("iptu", Number(e.target.value))} /></div>
          <div><Label>Condomínio (R$)</Label><Input type="number" step="0.01" value={form.condominio ?? 0} onChange={(e) => set("condominio", Number(e.target.value))} /></div>
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
          <div className="md:col-span-2">
            <Label>Fotos (URLs separadas por vírgula)</Label>
            <Input
              value={(form.fotos ?? []).join(", ")}
              onChange={(e) => set("fotos", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="https://..."
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
