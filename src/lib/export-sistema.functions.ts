import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { zipSync, strToU8 } from "fflate";

// Allowlist de colunas por tabela. NUNCA inclui paths/URLs de documentos
// nem campos sensíveis de storage. Apenas dados estruturados.
const ALLOWLIST: Record<string, string[]> = {
  leads: [
    "id", "nome", "telefone", "email", "origem", "regiao", "canal",
    "etapa", "responsavel_id", "valor", "observacoes",
    "first_response_at", "fechado_em", "reativacao_sugerida_em",
    "created_at", "updated_at",
  ],
  vendas_leads: [
    "id", "nome", "telefone", "email", "origem", "regiao", "tipo",
    "etapa", "corretor_id", "valor", "observacoes",
    "atribuicao_status", "atribuido_em", "first_response_at",
    "plantao_dia", "fechado_em", "reativacao_sugerida_em",
    "created_at", "updated_at",
  ],
  imoveis: [
    "id", "codigo", "titulo", "tipo", "finalidade", "status",
    "endereco", "bairro", "cidade", "uf", "cep",
    "valor_venda", "valor_aluguel", "valor_condominio", "valor_iptu",
    "area_total", "area_util", "quartos", "suites", "banheiros", "vagas",
    "created_at", "updated_at",
  ],
  contratos: [
    "id", "tipo", "status", "imovel_id", "inquilino_nome", "inquilino_cpf",
    "proprietario_nome", "valor_aluguel", "valor_venda",
    "data_inicio", "data_fim", "dia_vencimento",
    "created_at", "updated_at",
  ],
  financiamentos: [
    "id", "cliente_nome", "cliente_cpf", "valor_imovel", "valor_financiado",
    "banco", "status", "etapa", "responsavel_id", "observacoes",
    "aprovado_em", "recusado_em", "created_at", "updated_at",
  ],
  candidatos: [
    "id", "nome", "telefone", "email", "cidade", "uf",
    "etapa", "status", "score", "observacoes",
    "created_at", "updated_at",
  ],
};

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s: string;
    if (typeof v === "object") {
      try { s = JSON.stringify(v); } catch { s = String(v); }
    } else {
      s = String(v);
    }
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(",")).join("\n");
  return rows.length ? `${header}\n${body}\n` : `${header}\n`;
}

function u8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  // btoa exists in workerd
  return btoa(bin);
}

export const exportSistemaZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const files: Record<string, Uint8Array> = {};
    const resumo: Record<string, number> = {};

    for (const [tabela, cols] of Object.entries(ALLOWLIST)) {
      const { data, error } = await supabaseAdmin
        .from(tabela as never)
        .select(cols.join(","));
      if (error) {
        throw new Error(`Erro ao exportar ${tabela}: ${error.message}`);
      }
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      resumo[tabela] = rows.length;
      files[`${tabela}.csv`] = strToU8(toCsv(rows, cols));
    }

    const manifest = {
      gerado_em: new Date().toISOString(),
      gerado_por: context.userId,
      tabelas: resumo,
      observacao:
        "Exportação contém apenas campos estruturados (allowlist). Não inclui documentos, fotos ou URLs de storage.",
    };
    files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

    const zipped = zipSync(files, { level: 6 });
    const base64 = u8ToBase64(zipped);

    // Log de auditoria (Fase 2)
    try {
      await supabaseAdmin.rpc("log_audit", {
        _acao: "export_sistema",
        _contexto: { tabelas: resumo, tamanho_bytes: zipped.length } as never,
      });
    } catch {
      // não falha export por erro de log
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return {
      filename: `nexus-export-${stamp}.zip`,
      base64,
      tamanho: zipped.length,
      resumo,
    };
  });
