import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { etapaNome, canalNome, regiaoNome, etapaColor, type LeadRow, CANAIS, REGIOES, ETAPAS } from "@/lib/lead-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileSpreadsheet, Upload, Trash2 } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { CreateLeadDialog } from "@/components/create-lead-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type Resp = { id: string; nome: string; canal: string };

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — Sistema NEXUS" }] }),
  component: LeadsPage,
});

const EXPORT_HEADERS = [
  "id","nome","telefone","email","is_corretor","creci","regiao","tipo_imovel","faixa_valor",
  "observacoes","etapa","canal","responsavel_id","origem","motivo_perda",
  "first_response_at","fechado_em","created_at","updated_at",
] as const;

function leadToRow(l: LeadRow) {
  return {
    id: l.id, nome: l.nome, telefone: l.telefone, email: l.email ?? "",
    is_corretor: l.is_corretor ? "sim" : "não", creci: l.creci ?? "",
    regiao: regiaoNome(l.regiao), tipo_imovel: l.tipo_imovel ?? "",
    faixa_valor: l.faixa_valor ?? "", observacoes: l.observacoes ?? "",
    etapa: etapaNome(l.etapa), canal: canalNome(l.canal),
    responsavel_id: l.responsavel_id ?? "", origem: l.origem ?? "",
    motivo_perda: l.motivo_perda ?? "",
    first_response_at: l.first_response_at ?? "",
    fechado_em: l.fechado_em ?? "",
    created_at: l.created_at, updated_at: l.updated_at,
  };
}

function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [q, setQ] = useState("");
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [respFilter, setRespFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data as LeadRow[]) ?? []);
    setSelected(new Set());
  }

  useEffect(() => {
    load();
    supabase.from("responsaveis").select("id, nome, canal").order("nome").then(({ data }) => setResps((data as Resp[]) ?? []));
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle()
        .then(({ data: r }) => setIsAdmin(r?.role === "admin"));
    });
  }, []);

  const filtered = leads.filter((l) => {
    if (isAdmin && respFilter !== "all" && l.responsavel_id !== respFilter) return false;
    if (q && !l.nome.toLowerCase().includes(q.toLowerCase()) && !l.telefone.includes(q)) return false;
    return true;
  });
  const respFilterName = respFilter !== "all" ? resps.find((r) => r.id === respFilter)?.nome : null;

  function toggleOne(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }
  async function deleteSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} excluído(s)`);
    load();
  }


  function exportCsv() {
    const rows = filtered.map(leadToRow);
    const csv = [EXPORT_HEADERS.join(",")].concat(
      rows.map((r) => EXPORT_HEADERS.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportXlsx() {
    const rows = filtered.map(leadToRow);
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${Date.now()}.xlsx`);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { toast.error("CSV vazio"); return; }
      const parseLine = (line: string): string[] => {
        const out: string[] = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQ) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') inQ = false;
            else cur += c;
          } else {
            if (c === ",") { out.push(cur); cur = ""; }
            else if (c === '"') inQ = true;
            else cur += c;
          }
        }
        out.push(cur); return out;
      };
      const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
      const idx = (name: string) => headers.indexOf(name);
      const required = ["nome", "telefone", "regiao", "canal"];
      for (const r of required) if (idx(r) === -1) { toast.error(`Coluna obrigatória ausente: ${r}`); return; }

      const regiaoMap = new Map(REGIOES.map((r) => [r.nome.toLowerCase(), r.id] as const).concat(REGIOES.map((r) => [r.id.toLowerCase(), r.id] as const)));
      const canalMap = new Map(CANAIS.map((c) => [c.nome.toLowerCase(), c.id] as const).concat(CANAIS.map((c) => [c.id.toLowerCase(), c.id] as const)));
      const etapaMap = new Map(ETAPAS.map((e) => [e.nome.toLowerCase(), e.id] as const).concat(ETAPAS.map((e) => [e.id.toLowerCase(), e.id] as const)));

      type LeadInsert = {
        nome: string; telefone: string; email?: string | null;
        regiao: LeadRow["regiao"]; canal: LeadRow["canal"]; etapa?: LeadRow["etapa"];
        is_corretor?: boolean; creci?: string | null; tipo_imovel?: string | null;
        faixa_valor?: string | null; observacoes?: string | null; origem?: string | null;
      };
      const records: LeadInsert[] = [];
      for (let i = 1; i < lines.length; i++) {
        const c = parseLine(lines[i]);
        const get = (n: string) => { const j = idx(n); return j >= 0 ? (c[j] ?? "").trim() : ""; };
        const regiaoRaw = get("regiao").toLowerCase();
        const canalRaw = get("canal").toLowerCase();
        const regiao = regiaoMap.get(regiaoRaw);
        const canal = canalMap.get(canalRaw);
        if (!regiao || !canal) { toast.error(`Linha ${i + 1}: região/canal inválidos`); return; }
        const etapaRaw = get("etapa").toLowerCase();
        const etapa = etapaRaw ? etapaMap.get(etapaRaw) : undefined;
        records.push({
          nome: get("nome"), telefone: get("telefone"),
          email: get("email") || null,
          regiao, canal, etapa,
          is_corretor: ["sim", "true", "1", "yes"].includes(get("is_corretor").toLowerCase()),
          creci: get("creci") || null,
          tipo_imovel: get("tipo_imovel") || null,
          faixa_valor: get("faixa_valor") || null,
          observacoes: get("observacoes") || null,
          origem: get("origem") || "import_csv",
        });
      }
      const { error } = await supabase.from("leads").insert(records);
      if (error) throw error;
      toast.success(`${records.length} lead(s) importado(s)`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <header className="grid grid-cols-1 gap-3 md:flex md:flex-wrap md:items-end md:gap-4 md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {respFilterName
              ? `${filtered.length} leads de ${respFilterName}`
              : `${filtered.length} de ${leads.length} leads`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full md:w-64 h-11 md:h-10" />
          {isAdmin && (
            <Select value={respFilter} onValueChange={setRespFilter}>
              <SelectTrigger className="w-full md:w-52 h-11 md:h-10">
                <SelectValue placeholder="Filtrar por corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {resps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={exportCsv} className="h-11 md:h-10 flex-1 md:flex-none"><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={exportXlsx} className="h-11 md:h-10 flex-1 md:flex-none"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <CreateLeadDialog mode="lead" isAdmin={isAdmin} responsaveis={resps} onCreated={load} />
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-11 md:h-10 w-full md:w-auto">
                <Upload className="h-4 w-4" /> Importar CSV
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Bulk delete bar */}
      {isAdmin && selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /> Excluir selecionados</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selected.size} item(s)?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Mobile: cards empilhados */}
      <div className="md:hidden space-y-3">
        {filtered.map((l) => (
          <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            {isAdmin && (
              <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} className="mt-1" />
            )}
            <button onClick={() => setOpenLead(l.id)} className="flex-1 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{l.nome}</div>
                  <div className="text-sm text-muted-foreground truncate">{l.telefone}</div>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${etapaColor(l.etapa).badge}`}>{etapaNome(l.etapa)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{regiaoNome(l.regiao)}</span>
                <span className="shrink-0 ml-2">{format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
              </div>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 bg-card border border-border rounded-xl">
            Nenhum lead encontrado
          </div>
        )}
      </div>

      {/* Desktop: tabela — inalterado */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-10">
                  <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/40">
                {isAdmin && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                  </TableCell>
                )}
                <TableCell className="font-medium cursor-pointer" onClick={() => setOpenLead(l.id)}>{l.nome}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpenLead(l.id)}>{l.telefone}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpenLead(l.id)}>{regiaoNome(l.regiao)}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpenLead(l.id)}>{canalNome(l.canal)}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpenLead(l.id)}>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted">{etapaNome(l.etapa)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm cursor-pointer" onClick={() => setOpenLead(l.id)}>
                  {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                Nenhum lead encontrado
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LeadDetailSheet leadId={openLead} onClose={() => setOpenLead(null)} onUpdated={load} backLabel="Voltar aos Leads" />
    </div>
  );
}
