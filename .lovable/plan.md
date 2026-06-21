# Sistema de Plantão de Vendas — Plano Completo

## Regra de distribuição (decidida)
- **Facebook + região fixa conhecida** (Barra, Recreio, Belford Roxo, Nilópolis, Mesquita) → vai para a responsável da região (lógica atual, intocada).
- **Qualquer outra combinação** (ZAP Imóveis, OLX, Site, WhatsApp da empresa, Facebook sem região mapeada) → vai para o **plantonista do dia**.
- Pool de plantão: todos com role `corretor_vendas` + Executivos. Admin/Executivo escala livremente.
- Reincidência: toda nova mensagem de um lead reatribui ao plantonista do dia atual (plantão é por dia inteiro, sem troca no meio do dia).

## Mudanças no banco

### 1. Novos campos em `vendas_leads`
- `origem` (enum: `zap_imoveis`, `olx`, `site`, `whatsapp_empresa`, `facebook`, `manual`, `outro`)
- `origem_detalhe` (texto livre, opcional — ex.: id do anúncio)
- `ultima_mensagem_em` (timestamp — usado para reincidência)
- `plantao_dia` (data — registra de qual dia de plantão o lead veio, para auditoria)

### 2. Nova tabela `plantao_escala`
```text
id, data (date, único), corretor_id (uuid), criado_por, created_at, updated_at
```
RLS: Admin/Executivo gerenciam; corretores leem (precisam ver a própria escala).

### 3. Nova tabela `plantao_log`
Auditoria de cada atribuição automática: `lead_id`, `corretor_id`, `motivo` (novo_lead, reincidencia, redirecionamento_demora), `origem`, `criado_em`.

### 4. Funções SQL
- `plantonista_do_dia(data date)` → retorna `corretor_id` da escala daquele dia, ou NULL.
- `is_corretor_vendas_ou_executivo(uid)` → helper para o pool.

## Mudanças no servidor

### 5. Webhook `/api/public/webhook` (já existente) — refatorado
- Detecta `origem` a partir do payload (form_id, source, headers).
- **Se `origem = facebook` E região está em {barra, recreio, belford_roxo, nilopolis, mesquita}** → mantém fluxo atual (grava em `leads`, push para responsável).
- **Senão** → grava em `vendas_leads` com:
  - `origem` correta
  - `corretor_id = plantonista_do_dia(hoje)`
  - `atribuicao_status = 'pendente'`
  - `plantao_dia = hoje`
- Push direcionado ao **plantonista** (via `external_id`), não mais broadcast "All".
- Se não há plantonista escalado → notifica admins + log de erro.

### 6. Novo webhook `/api/public/lead-mensagem` (reincidência)
- Recebe `{ telefone, origem, mensagem }`.
- Procura `vendas_leads` existente por telefone.
- Se encontrado → atualiza `ultima_mensagem_em`; se o plantonista de hoje ≠ corretor atual do lead, reatribui ao plantonista de hoje (log do motivo `reincidencia`).
- Se não encontrado → cria novo lead via mesma lógica do webhook.

### 7. Server functions novas (`src/lib/plantao.functions.ts`)
- `getEscalaMes({ ano, mes })` — admin/exec listam.
- `setPlantonista({ data, corretor_id })` — admin/exec escalam.
- `removerPlantonista({ data })`.
- `listCorretoresElegiveis()` — pool de corretor_vendas + executivos.
- `getMeuPlantaoProximo()` — corretor vê seus próximos plantões.

### 8. Correção do `atribuirLead` (vendas-distribuicao.functions.ts)
- Substituir `included_segments: ["All"]` por push direcionado via `external_id` do corretor atribuído (+ opcional cópia para admins).

## Frontend

### 9. Tela `/_authenticated/vendas/plantao` (dentro da aba Vendas)
- Calendário mensal (grid 7×N).
- Cada dia: dropdown com elegíveis + nome do plantonista escalado.
- Admin/Executivo editam; corretores só veem.
- Banner topo: "Plantonista de hoje: X".

### 10. Item no menu Vendas
- Adicionar "Plantão" em `vendas.tsx` (desktop e mobile), junto com Dashboard, Leads, Pipeline, Agenda.

### 11. Indicadores em `vendas.index.tsx`
- Card "Leads do meu plantão hoje": quantos recebi, quantos aceitei.

## Métricas e auditoria
- `plantao_log` alimenta relatório futuro de quantos leads cada corretor recebeu/aceitou/recusou por plantão.
- (Relatórios visuais ficam para iteração seguinte — agora só persistimos os dados.)

## Itens fora do escopo desta entrega
- Redirecionamento por demora (>X min sem atendimento) — registro de campos prontos, lógica de cron fica para próxima.
- Tela de relatórios de plantão — dados ficam prontos, UI vem depois.
- Ativação manual de push pelos 3 corretores sem `onesignal_external_id` (Robson Terra, Denise, Pedro) — não é código, eles precisam abrir o app e aceitar notificação.

## Ordem de execução
1. Migration (campos + tabelas + funções SQL + RLS + grants).
2. Server functions de plantão.
3. Refatorar webhook + criar webhook de mensagem.
4. Corrigir push do `atribuirLead`.
5. Tela de gestão de plantão + item no menu.
6. Card de plantão no dashboard de Vendas.
