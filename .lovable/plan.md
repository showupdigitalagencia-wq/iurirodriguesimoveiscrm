# Plano — 8 Melhorias

Implementação em **8 fases independentes**, uma por melhoria, na ordem listada. Cada fase termina com o usuário aprovando antes de seguir.

---

## ⚠️ Alertas de risco (antes de codificar)

### Item 3 — Lead 360°
- **Risco de vazamento entre módulos**: Admin já tem acesso a tudo no sistema, então restringir só a Admin + mostrar resumo (status, sem arquivos) **resolve** a preocupação. Reforços que vou aplicar:
  - Endpoint server-side com `requireSupabaseAuth` + checagem `has_role('admin')` — sem isso, vira endpoint público.
  - Retorno explícito de colunas (nada de `select *`): nunca incluir URLs de Storage, paths de documentos, observações sigilosas de financiamento, score de crédito, dados bancários.
  - Cada item da timeline traz só um `deep_link` para a tela específica do módulo (ex: `/admin/financiamentos/:id`) — o controle de acesso ao arquivo continua sendo da tela de origem.
  - Toda busca registra em `audit_log` (quem buscou, qual telefone/CPF, quantos resultados) — rastreabilidade obrigatória num "super-acesso".
- **Confirmação que preciso de você**: ok manter Admin como único papel com acesso, sem dar acesso ao Executivo nem mesmo para leads da equipe dele?

### Item 8 — Google Calendar (FreeBusy)
- **Risco técnico**: já existe a tabela `google_tokens` (vi nos schemas), então a infra de OAuth está pronta. FreeBusy só precisa do escopo `calendar.readonly` ou `calendar.freebusy` — se o token atual não tiver, o usuário precisa reconectar uma vez.
- **Risco de UX**: chamada de rede síncrona antes de salvar agendamento adiciona ~300-800ms. Vou fazer com timeout de 3s — se a API do Google estourar, pula a verificação silenciosamente (mesmo comportamento de "sem Google conectado") em vez de travar o agendamento.
- **Risco de privacidade**: FreeBusy retorna só "ocupado/livre" (sem título, sem participantes), então não vaza conteúdo de eventos pessoais. ✅ Seguro.
- **Sem confirmação adicional necessária** — sigo direto quando chegar a fase.

---

## Fase 1 — Funil de Conversão Visual
- Função SQL `get_funil_conversao(_pipeline, _from, _to, _scope, _target)` que lê `lead_historico` (Captação) e logs equivalentes de `vendas_leads` para contar "passaram pela etapa" + estado atual.
- Se não existir histórico de etapa em `vendas_leads`, adicionar trigger que registra mudanças de `etapa` numa tabela nova `vendas_lead_historico` (espelho do `lead_historico`).
- Tela `/admin/funil` (Admin/Executivo) e card "Meu funil" no dashboard do corretor.
- Componente reutilizável de barras horizontais decrescentes com % entre etapas.

## Fase 2 — Tempo Médio de Resposta Geral
- Reaproveitar `first_response_at` (já existe) — confirmar via trigger que ele é setado quando etapa sai de "Novo".
- RPC `get_tempo_resposta_ranking(_from, _to, _scope)` retornando média por corretor + lista "aguardando primeiro contato".
- Tela `/admin/tempo-resposta` (ranking) + card no dashboard do corretor (só o próprio número).

## Fase 3 — Lead 360°
- Função `normalize_telefone(text)` no banco (remove tudo que não é dígito, mantém últimos 11).
- RPC `buscar_lead_360(_telefone, _cpf)` com gate `has_role('admin')`, retorno colunado e sem URLs sensíveis.
- Auditoria de toda busca em `audit_log`.
- Tela `/admin/lead-360` (só Admin no menu e no roteamento).

## Fase 4 — Pesquisa de Satisfação Pós-Venda
- Tabela `pesquisas_satisfacao` (lead_id, corretor_id, enviada_em, nota, comentario, status).
- Trigger em `vendas_leads` para etapa→fechado: insere registro pendente.
- Server function dispara WhatsApp via Z-API (já configurada — `ZAPI_*`).
- Webhook de entrada do Z-API: tenta extrair 1-5 da resposta dentro de 48h da `enviada_em`; senão marca `sem_resposta_valida`.
- Métrica "Nota média" no relatório de vendas.

## Fase 5 — Metas Mensais
- Tabela `metas_mensais` + RLS (corretor lê a própria; admin/executivo escreve).
- Tela admin/executivo para definir metas do mês atual (bloqueio de edição de meses passados via policy/check).
- Componente "Barra de progresso" no dashboard do corretor.

## Fase 6 — Comparativo entre Regiões
- RPC `get_comparativo_regioes(_from, _to)` agregando vendas_leads por `regiao`.
- Tela `/admin/regioes` com 4 cards/colunas, ordenação por taxa de conversão.

## Fase 7 — Backup Automático Semanal
- Bucket privado `backups-sistema` (criar via tool).
- Server route `/api/public/hooks/backup-semanal` chama `exportSistemaZip` (refatorar para também retornar buffer, não só base64), faz upload no bucket com nome `backup-YYYY-MM-DD.zip`, apaga arquivos com >56 dias, registra em `audit_log`.
- `pg_cron` segunda 09:00 UTC (06:00 BRT) chamando o endpoint via `pg_net`.
- Seção em Configurações → Admin listando backups com download (URL assinada de 5min).

## Fase 8 — Sincronização Google Calendar (FreeBusy)
- Server function `verificarConflitoGoogleCalendar({ start, end })` que:
  - Lê `google_tokens` do usuário; se ausente → `{ verificado: false }`.
  - Chama `freeBusy.query` via connector gateway com timeout 3s.
  - Erro/timeout → `{ verificado: false }` (não bloqueia).
- Integrar no fluxo de criar Visita e criar Reunião: se `conflito === true`, modal de confirmação antes de salvar.

---

## Convenções aplicadas em todas as fases
- Mudanças sensíveis registradas em `audit_log` via `log_audit()`.
- Toda nova RPC com `SECURITY DEFINER` + checagem explícita de papel.
- Todo GRANT correto em novas tabelas públicas.
- Sem hardcode de cor — usar tokens do design system existente.

---

**Confirma o plano e o item 3 (Admin como único acesso)?** Assim que aprovar, começo pela Fase 1.