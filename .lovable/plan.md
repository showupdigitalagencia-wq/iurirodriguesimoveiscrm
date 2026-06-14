## Sistema de Agenda e Reuniões

Vou implementar um módulo completo de agenda integrado ao CRM, sem dependência do Google Calendar.

### 1. Banco de dados (migração)

**Tabela `reunioes`:**
- `id`, `titulo`, `descricao`, `data_inicio` (timestamptz), `duracao_min` (int, default 60)
- `local` (text — endereço ou link)
- `tipo` (enum: `individual` | `institucional`)
- `status` (enum: `agendada` | `realizada` | `cancelada`)
- `resultado` (text, preenchido após realizar)
- `criado_por` (uuid → auth.users)
- `created_at`, `updated_at`

**Tabela `reuniao_participantes`:**
- `id`, `reuniao_id`, `lead_id` (nullable), `responsavel_id` (nullable)
- Um registro por participante (lead OU corretor)

**Tabela `reuniao_lembretes`:**
- `id`, `reuniao_id`, `tipo` (`1d` | `1h` | `15min`), `enviado_em` (nullable)
- Usada para evitar duplicar disparo via cron

**RLS:** todos autenticados podem ler/criar/editar reuniões (todos os corretores veem tudo, conforme requisito). GRANTs para `authenticated` e `service_role`.

### 2. Server functions (`src/lib/reunioes.functions.ts`)
- `listReunioes({ from, to })` — busca por intervalo
- `getReuniao(id)` — detalhes + participantes
- `createReuniao(input)` — cria, vincula participantes, move leads → `reuniao_agendada`, dispara push para todos
- `updateReuniaoStatus(id, status, resultado?)` — atualiza status

### 3. UI

**`src/routes/_authenticated/agenda.tsx`** — nova rota:
- Toggle de visão: Dia / Semana / Mês
- Grid responsiva; eventos coloridos (azul `individual`, dourado `institucional`)
- Clique abre `ReuniaoDetailDialog`
- Botão "Nova Reunião"

**`src/components/reuniao-form-dialog.tsx`** — formulário compartilhado:
- Data/hora, local, tipo (radio), descrição
- Multi-select de leads e de corretores (responsáveis)
- Validação Zod

**`src/components/reuniao-detail-dialog.tsx`** — detalhes + ações de status + campo resultado

**Integração no `lead-detail-sheet.tsx`:**
- Novo botão "Agendar Reunião" abrindo o form com o lead pré-selecionado

**Menu (`_authenticated/route.tsx`):**
- Adicionar item `{ to: "/agenda", label: "Agenda", icon: CalendarDays }` no `NAV`

### 4. Notificações push

**Ao criar reunião** (dentro de `createReuniao`):
- Buscar `onesignal_external_id` de todos `responsaveis` + admins
- Enviar via `sendOneSignalPush()` com fallback para segmento `All`
- Mensagem: `Nova reunião agendada por {nome} | {data} às {hora} | {tipo}`
- URL deep link: `/agenda?open={reuniao_id}`

**Lembretes automáticos:**
- Nova rota `src/routes/api/public/cron-reuniao-lembretes.ts`
- Para cada reunião `agendada` futura, calcula janelas `1d`, `1h`, `15min` (±5min de tolerância)
- Marca em `reuniao_lembretes` para não duplicar
- Cron pg_cron rodando a cada 5 minutos

### 5. Pipeline automático
- No `createReuniao`: para cada `lead_id` participante, `UPDATE leads SET etapa = 'reuniao_agendada'` + log em `lead_historico`
- No `updateReuniaoStatus('realizada')`: retorna sugestão; UI mostra toast com botão "Mover lead para Em Negociação"

### 6. Mobile
- Layout do calendário: scroll horizontal em mês/semana; lista vertical em dia (default no mobile via `useIsMobile`)
- Botões com `min-h-11` para toque
- Bottom-sheet variant do `Dialog` em telas pequenas

### Arquivos

**Criados:**
- migração SQL (`reunioes`, `reuniao_participantes`, `reuniao_lembretes` + enums + RLS + grants)
- `src/lib/reunioes.functions.ts`
- `src/routes/_authenticated/agenda.tsx`
- `src/components/reuniao-form-dialog.tsx`
- `src/components/reuniao-detail-dialog.tsx`
- `src/components/agenda-calendar.tsx` (grade dia/semana/mês)
- `src/routes/api/public/cron-reuniao-lembretes.ts`

**Editados:**
- `src/routes/_authenticated/route.tsx` (menu)
- `src/components/lead-detail-sheet.tsx` (botão Agendar)
- pg_cron job (via insert tool) chamando o endpoint de lembretes a cada 5min

### Confirmações antes de prosseguir
1. **Lembretes via push:** OK usar o mesmo fluxo OneSignal (individual + fallback `All`) já existente?
2. **Visibilidade:** confirmado que **todos** os corretores veem **todas** as reuniões (sem filtro por responsável)?
3. **Lead na reunião:** ao agendar, mover automaticamente TODOS os leads participantes para `reuniao_agendada` — inclusive se já estiverem em etapa posterior (ex: `em_negociacao`)? Ou só mover se estiver em etapa anterior?