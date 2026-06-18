import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, Upload, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;

// Columns we export/import. Keep order stable for usability.
const COLUMNS: { key: string; label: string }[] = [
  { key: "codigo", label: "Código" },
  { key: "tipo", label: "Tipo" },
  { key: "finalidade", label: "Finalidade" },
  { key: "status", label: "Status" },
  { key: "rua", label: "Rua" },
  { key: "numero", label: "Número" },
  { key: "complemento", label: "Complemento" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "cep", label: "CEP" },
  { key: "proprietario_nome", label: "Proprietário" },
  { key: "proprietario_documento", label: "CPF/CNPJ" },
  { key: "proprietario_telefone", label: "Telefone" },
  { key: "proprietario_email", label: "Email" },
  { key: "valor_aluguel", label: "Valor Aluguel" },
  { key: "valor_venda", label: "Valor Venda" },
  { key: "iptu", label: "IPTU" },
  { key: "condominio", label: "Condomínio" },
  { key: "area_m2", label: "Área m²" },
  { key: "quartos", label: "Quartos" },
  { key: "banheiros", label: "Banheiros" },
  { key: "vagas", label: "Vagas" },
  { key: "garantia", label: "Garantia" },
  { key: "observacoes", label: "Observações" },
];

const NUMERIC = new Set(["valor_aluguel", "valor_venda", "iptu", "condominio", "area_m2", "quartos", "banheiros", "vagas"]);

function toRows(imoveis: Row[]) {
  return imoveis.map((i) => {
    const r: Row = {};
    for (const c of COLUMNS) r[c.label] = i[c.key] ?? "";
    return r;
  });
}

// Build flexible label→key map (lowercased + accent stripped)
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const LABEL_TO_KEY = new Map<string, string>();
for (const c of COLUMNS) {
  LABEL_TO_KEY.set(norm(c.label), c.key);
  LABEL_TO_KEY.set(norm(c.key), c.key);
}
// Aliases — common variants found in planilhas reais
const ALIASES: Record<string, string> = {
  "proprietario": "proprietario_nome",
  "nome do proprietario": "proprietario_nome",
  "dono": "proprietario_nome",
  "imovel": "rua",
  "endereco": "rua",
  "endereco completo": "rua",
  "logradouro": "rua",
  "telefone proprietario": "proprietario_telefone",
  "celular": "proprietario_telefone",
  "whatsapp": "proprietario_telefone",
  "email proprietario": "proprietario_email",
  "cpf": "proprietario_documento",
  "cnpj": "proprietario_documento",
  "cpf/cnpj": "proprietario_documento",
  "documento": "proprietario_documento",
  "aluguel": "valor_aluguel",
  "valor aluguel": "valor_aluguel",
  "valor do aluguel": "valor_aluguel",
  "valor": "valor_aluguel",
  "valor venda": "valor_venda",
  "valor do imovel": "valor_venda",
  "valor de venda": "valor_venda",
  "area": "area_m2",
  "metragem": "area_m2",
  "quarto": "quartos",
  "dormitorios": "quartos",
  "banheiro": "banheiros",
  "vaga": "vagas",
  "garagem": "vagas",
  "obs": "observacoes",
  "observacao": "observacoes",
};
for (const [k, v] of Object.entries(ALIASES)) LABEL_TO_KEY.set(norm(k), v);

// Find header row: first row (within first 20) containing >=2 known labels.
function findHeaderRow(matrix: unknown[][]): { headerIdx: number; headers: string[] } | null {
  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const row = matrix[r] ?? [];
    const known = row.filter((c) => c != null && LABEL_TO_KEY.has(norm(c))).length;
    if (known >= 2) return { headerIdx: r, headers: row.map((c) => String(c ?? "")) };
  }
  return null;
}

export function ImoveisImportExport({ imoveis, onImported }: { imoveis: Row[]; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(toRows(imoveis));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Imóveis");
    XLSX.writeFile(wb, `imoveis-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportCSV() {
    const ws = XLSX.utils.json_to_sheet(toRows(imoveis));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imoveis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const cols = ["Código", "Tipo", "Finalidade", "Status", "Endereço", "Proprietário", "Aluguel", "Venda"];
    const body = imoveis.map((i) => [
      i.codigo ?? "",
      i.tipo ?? "",
      i.finalidade ?? "",
      i.status ?? "",
      `${i.rua ?? ""}${i.numero ? ", " + i.numero : ""}${i.bairro ? " — " + i.bairro : ""}${i.cidade ? " / " + i.cidade : ""}`,
      i.proprietario_nome ?? "",
      i.valor_aluguel != null ? Number(i.valor_aluguel).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      i.valor_venda != null ? Number(i.valor_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
    ]);
    doc.setFontSize(14);
    doc.text("Imóveis", 14, 14);
    autoTable(doc, { head: [cols], body, startY: 20, styles: { fontSize: 8 } });
    doc.save(`imoveis-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function downloadTemplate() {
    const headers = COLUMNS.map((c) => c.label);
    const example: Row = {};
    for (const h of headers) example[h] = "";
    example["Tipo"] = "apartamento";
    example["Finalidade"] = "locacao";
    example["Status"] = "disponivel_locacao";
    example["Rua"] = "Rua Exemplo";
    example["Proprietário"] = "Nome do Proprietário";
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo-imoveis.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      let rows: Row[] = [];
      if (/\.csv$/i.test(file.name)) {
        const text = new TextDecoder().decode(buf);
        const wb = XLSX.read(text, { type: "string" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else {
        const wb = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      if (!rows.length) {
        toast.error("Arquivo vazio");
        return;
      }

      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id;

      const payloads = rows.map((raw) => {
        const out: Row = { created_by: uid };
        for (const [k, v] of Object.entries(raw)) {
          const key = LABEL_TO_KEY.get(norm(k));
          if (!key) continue;
          if (v === "" || v == null) continue;
          out[key] = NUMERIC.has(key) ? Number(String(v).toString().replace(/[^0-9.,-]/g, "").replace(",", ".")) : v;
        }
        if (!out.tipo) out.tipo = "apartamento";
        if (!out.status) out.status = "disponivel_locacao";
        if (!out.finalidade) out.finalidade = "locacao";
        return out;
      }).filter((p) => p.rua && p.proprietario_nome);

      if (!payloads.length) {
        toast.error("Nenhuma linha válida (rua e proprietário são obrigatórios)");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("imoveis").insert(payloads as any);
      if (error) throw error;
      toast.success(`${payloads.length} imóve${payloads.length === 1 ? "l importado" : "is importados"}`);
      onImported();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={importing}>
            <Upload className="h-4 w-4 mr-1" /> Importar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Importar imóveis</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel ou CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Baixar modelo (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportCSV}>
            <FileType className="h-4 w-4 mr-2" /> CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
