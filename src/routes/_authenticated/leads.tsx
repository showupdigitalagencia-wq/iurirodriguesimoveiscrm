import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ETAPAS, etapaNome, canalNome, regiaoNome, type LeadRow } from "@/lib/lead-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — CRM" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [q, setQ] = useState("");
  const [openLead, setOpenLead] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data as LeadRow[]) ?? []);
  }


  useEffect(() => { load(); }, []);


  const filtered = leads.filter((l) =>
    !q || l.nome.toLowerCase().includes(q.toLowerCase()) || l.telefone.includes(q));

  function exportCsv() {
    const headers = ["Nome", "Telefone", "Email", "Região", "Canal", "Etapa", "Criado em"];
    const rows = filtered.map((l) => [
      l.nome, l.telefone, l.email ?? "", regiaoNome(l.regiao), canalNome(l.canal),
      etapaNome(l.etapa), format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} de {leads.length} leads</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="gold" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar</Button>
        </div>
      </header>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenLead(l.id)}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell>{l.telefone}</TableCell>
                <TableCell>{regiaoNome(l.regiao)}</TableCell>
                <TableCell>{canalNome(l.canal)}</TableCell>
                <TableCell>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted">{etapaNome(l.etapa)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum lead encontrado
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
