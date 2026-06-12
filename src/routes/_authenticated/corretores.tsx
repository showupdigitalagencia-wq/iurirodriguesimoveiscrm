import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canalNome, type LeadRow } from "@/lib/lead-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, BadgeCheck, XCircle, HelpCircle } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";

type DadosCorretor = {
  ja_corretor?: string | null;
  creci_ativo?: string | null;
  numero_creci?: string | null;
  disponibilidade_barra?: string | null;
  disponibilidade_video?: string | null;
  possui_veiculo?: string | null;
};

type CorretorLead = LeadRow & { dados_corretor: DadosCorretor | null };

export const Route = createFileRoute("/_authenticated/corretores")({
  head: () => ({ meta: [{ title: "Captação de Corretores — CRM" }] }),
  component: CorretoresPage,
});

function YesNo({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const v = value.toLowerCase();
  if (v.startsWith("sim") || v.startsWith("yes") || v === "true") {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" />{value}</span>;
  }
  if (v.startsWith("não") || v.startsWith("nao") || v.startsWith("no") || v === "false") {
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />{value}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><HelpCircle className="h-3.5 w-3.5" />{value}</span>;
}

function CorretoresPage() {
  const [leads, setLeads] = useState<CorretorLead[]>([]);
  const [q, setQ] = useState("");
  const [openLead, setOpenLead] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("is_corretor", true)
      .order("created_at", { ascending: false });
    setLeads((data as CorretorLead[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  const filtered = leads.filter((l) =>
    !q || l.nome.toLowerCase().includes(q.toLowerCase()) || l.telefone.includes(q));

  function exportCsv() {
    const headers = [
      "Nome", "Telefone", "Email", "Já corretor", "CRECI ativo", "Nº CRECI",
      "Disp. Barra", "Disp. Video", "Possui veículo", "Canal", "Criado em",
    ];
    const rows = filtered.map((l) => {
      const d = l.dados_corretor ?? {};
      return [
        l.nome, l.telefone, l.email ?? "",
        d.ja_corretor ?? "", d.creci_ativo ?? "", d.numero_creci ?? "",
        d.disponibilidade_barra ?? "", d.disponibilidade_video ?? "", d.possui_veiculo ?? "",
        canalNome(l.canal), format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `corretores-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Captação de Corretores</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} de {leads.length} candidatos</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="gold" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar</Button>
        </div>
      </header>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Já corretor</TableHead>
              <TableHead>CRECI</TableHead>
              <TableHead>Nº CRECI</TableHead>
              <TableHead>Barra</TableHead>
              <TableHead>Video</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => {
              const d = l.dados_corretor ?? {};
              return (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenLead(l.id)}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-sm">
                    <div>{l.telefone}</div>
                    {l.email && <div className="text-muted-foreground text-xs">{l.email}</div>}
                  </TableCell>
                  <TableCell><YesNo value={d.ja_corretor} /></TableCell>
                  <TableCell><YesNo value={d.creci_ativo} /></TableCell>
                  <TableCell className="text-sm">{d.numero_creci ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><YesNo value={d.disponibilidade_barra} /></TableCell>
                  <TableCell><YesNo value={d.disponibilidade_video} /></TableCell>
                  <TableCell><YesNo value={d.possui_veiculo} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Nenhuma captação de corretor recebida ainda.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LeadDetailSheet leadId={openLead} onClose={() => setOpenLead(null)} onUpdated={load} backLabel="Voltar aos Corretores" />
    </div>
  );
}
