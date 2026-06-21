
# Plano de Implementação — 5 Melhorias Estruturais

Cada fase é independente e será implementada **somente após sua confirmação explícita**. Em nenhuma fase eu altero RLS, policies ou GRANTs de tabelas pré-existentes (`leads`, `vendas_leads`, `imoveis`, `contratos`, `financiamentos`, `candidatos`, `profiles`, `user_roles`, `plantao_escala`, `vendas_visitas`, etc.). Quando precisar adicionar coluna nova nessas tabelas, só faço `ALTER TABLE … ADD COLUMN` (sem tocar policy). Caso alguma fase exija ajustar RLS, eu paro e te aviso antes.

---

## FASE 1 — Dashboard de Saúde do Sistema (Admin)

**Rota:** `/admin/saude-sistema` (já dentro do layout `_authenticated`, gate de admin no próprio componente via `has_role`).

**3 cards:**
- **Notificações Push** — % de pushes entregues 24h e 7d, lidos da tabela `notificacoes` filtrando por canal push e status de resposta da OneSignal já gravado.
- **Webhooks** — para cada `origem` de `leads` e `vendas_leads` (zap_imoveis, olx, site, whatsapp_empresa, facebook), mostrar `MAX(created_at)` (última recebida) + contagem de erros 24h (via tabela `webhook_log`, ver abaixo).
- **Plantão** — varre `plantao_escala` para os próximos 7 dias; destaca em vermelho qualquer dia sem corretor escalado.

**Banco (somente novo, sem mexer no existente):**
- Nova tabela `webhook_log(id, fonte text, status_code int, sucesso bool, erro text, payload_resumo jsonb, criado_em timestamptz)` — RLS habilitada, SELECT só para admin, INSERT só service_role. Webhooks existentes começam a logar nela (alteração aditiva nos handlers `/api/public/*` — não muda comportamento).
- Função `get_saude_sistema()` SECURITY DEFINER, retorna JSON consolidado, exposta só a `authenticated` (checa `has_role(admin)` internamente).

**Frontend:** uma página com `useQuery` chamando a RPC ao montar.

---

## FASE 2 — Log de Auditoria (Admin)

**Banco:**
- Nova tabela `audit_log(id, user_id uuid, user_nome text, acao text, tabela text, registro_id text, antes jsonb, depois jsonb, contexto jsonb, criado_em)`.
- RLS: INSERT permitido a `authenticated` (qualquer ação autenticada pode logar a si mesma), SELECT só admin, sem UPDATE/DELETE. GRANTs explícitos.
- Função `log_audit(_acao, _tabela, _registro_id, _antes, _depois, _contexto)` SECURITY DEFINER para insert padronizado.

**Pontos de instrumentação (só adições, sem tocar RLS das tabelas-alvo):**
1. Aprovação/recusa de financiamento → chamar `log_audit` no server-fn ou no componente da Lorena.
2. Visualização de documento de candidato → chamar `log_audit` quando a URL assinada do storage for gerada.
3. Reatribuição manual de lead (admin/executivo trocando `corretor_id`/`responsavel_id`) → log no server-fn de reatribuição.
4. DELETE em `candidatos`, `imoveis`, `financiamentos` → trigger `AFTER DELETE` que escreve em `audit_log` (não bloqueia, não muda permissão).
5. Mudança de role (INSERT/DELETE em `user_roles`) → trigger `AFTER INSERT OR DELETE`.

**Frontend:** `/admin/auditoria` com tabela filtrável (usuário, ação, período).

---

## FASE 3 — Rastreio de Visita Realizada

**Banco (tabela `vendas_visitas` já existe):**
- `ALTER TABLE vendas_visitas ADD COLUMN realizada bool, comparecimento text CHECK (comparecimento IN ('realizada','nao_compareceu') OR comparecimento IS NULL), confirmada_em timestamptz, confirmada_por uuid`. Sem mexer em RLS existente.

**Frontend:**
- No card do lead em `/vendas`, quando houver `vendas_visitas` com `data_hora < now()` e `comparecimento IS NULL`, mostrar prompt: "Como foi a visita de [data]?" com 2 botões.
- Server-fn `confirmarVisita({ visita_id, comparecimento })` atualiza a linha (RLS já permite ao corretor dono).

**Dashboard de Vendas:**
- Novo KPI "Taxa de comparecimento": `realizadas / (realizadas + nao_compareceu)` no período já filtrado (estendo a RPC `get_vendas_relatorio_v2` adicionando esse campo — função nova que criei na última iteração, não toco no comportamento de acesso).

---

## FASE 4 — Reativação de Leads Perdidos

**Configurações:**
- Adicionar chave `lead_reativacao_dias` (default 60) na tabela `configuracoes` existente. UI em `/admin` (Configurações) com input numérico.

**Banco:**
- `ALTER TABLE leads ADD COLUMN reativacao_sugerida_em timestamptz`.
- `ALTER TABLE vendas_leads ADD COLUMN reativacao_sugerida_em timestamptz`.
- Sem alterar RLS.

**Cron:**
- Rota `POST /api/public/hooks/reativacao-leads-perdidos` (auth por `apikey` do anon).
- Lê o parâmetro `lead_reativacao_dias`, busca leads `etapa='perdido'` cuja data de mudança para perdido (`lead_historico` para captação, `updated_at` como fallback para vendas) excede o prazo **e** `reativacao_sugerida_em IS NULL`.
- Envia push via OneSignal (segredo já existente) e marca `reativacao_sugerida_em = now()`.
- pg_cron diário às 9h (`0 9 * * *`).

---

## FASE 5 — Exportação de Dados

**Frontend (Admin → Configurações):**
- Botão "Exportar dados do sistema".

**Server (server-fn `exportSistemaZip`):**
- Verifica `has_role(admin)`. Lê com `supabaseAdmin`: `leads`, `vendas_leads`, `imoveis`, `contratos`, `financiamentos`, `candidatos`.
- **Não toca em Storage, não inclui colunas de paths de documentos** — projeta só campos estruturados (definidos numa allowlist explícita por tabela, especialmente em `candidatos` para excluir `*_url`/`*_path`).
- Gera CSVs em memória, empacota num ZIP (lib pure-JS compatível com Worker: `fflate`), retorna como `Response` com `Content-Disposition: attachment`.
- Chama `log_audit('export_sistema', ...)` (depende da Fase 2 estar pronta).

---

## Resumo das mudanças no banco

```text
Fase 1: + tabela webhook_log; + função get_saude_sistema
Fase 2: + tabela audit_log; + função log_audit;
        + triggers em candidatos/imoveis/financiamentos/user_roles
Fase 3: ALTER vendas_visitas (4 colunas novas)
Fase 4: + chave em configuracoes;
        ALTER leads/vendas_leads (1 coluna nova cada)
Fase 5: nenhuma mudança de schema (só lê)
```

Nenhuma RLS/policy existente é alterada. Toda nova tabela vem com RLS + GRANTs corretos desde o início.

---

**Posso começar pela Fase 1?** Me confirma e sigo. Se quiser reordenar ou tirar algo, é só falar.
