import { createFileRoute } from "@tanstack/react-router";
import { buildExportZipBuffer } from "@/lib/export-sistema.functions";

// Endpoint público (auth por apikey) chamado pelo pg_cron toda segunda 09:00 UTC.
// Gera o ZIP, salva no bucket privado `backups-sistema` e apaga backups com >56 dias.
async function runBackup() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const built = await buildExportZipBuffer(null);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const objectPath = `backup-${today}.zip`;

  // Upload (upsert=true para idempotência se rodar duas vezes no mesmo dia)
  const { error: upErr } = await supabaseAdmin.storage
    .from("backups-sistema")
    .upload(objectPath, built.bytes, {
      contentType: "application/zip",
      upsert: true,
    });
  if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

  // Cleanup: apaga arquivos com nome backup-YYYY-MM-DD.zip com data >56 dias
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 56);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const { data: listed } = await supabaseAdmin.storage
    .from("backups-sistema")
    .list("", { limit: 1000 });

  const apagar: string[] = [];
  for (const item of listed ?? []) {
    const m = item.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.zip$/);
    if (m && m[1] < cutoffISO) apagar.push(item.name);
  }
  let removidos = 0;
  if (apagar.length > 0) {
    const { error: delErr } = await supabaseAdmin.storage
      .from("backups-sistema")
      .remove(apagar);
    if (!delErr) removidos = apagar.length;
  }

  try {
    await supabaseAdmin.rpc("log_audit", {
      _acao: "backup_semanal",
      _contexto: {
        arquivo: objectPath,
        tamanho_bytes: built.bytes.length,
        tabelas: built.resumo,
        removidos_antigos: removidos,
      } as never,
    });
  } catch {
    // não falha por erro de log
  }

  return {
    ok: true,
    arquivo: objectPath,
    tamanho_bytes: built.bytes.length,
    removidos_antigos: removidos,
    resumo: built.resumo,
  };
}

export const Route = createFileRoute("/api/public/hooks/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: apikey header == VITE_SUPABASE_PUBLISHABLE_KEY (chamada de dentro do banco via pg_net)
        const apiKey = request.headers.get("apikey") ?? request.headers.get("Apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await runBackup();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro_desconhecido";
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
