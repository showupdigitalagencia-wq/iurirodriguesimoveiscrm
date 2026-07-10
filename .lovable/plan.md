# Central de Conversas — Arquitetura + Fases 1 e 2

## 1. Arquitetura de hospedagem (recomendação)

**Uma única instalação da Evolution API v2** rodando em Docker, gerenciando N instâncias (uma por usuário Nexus).

**Stack recomendada (melhor custo/benefício para centenas de sessões):**

- **VPS Hetzner CPX31** (4 vCPU / 8GB / 160GB SSD — ~€15/mês) ou equivalente na Contabo/DigitalOcean.
- **Coolify** instalado na VPS como painel (deploy, SSL Let's Encrypt automático, logs, backup, restart).
- **Evolution API v2** em container Docker gerenciado pelo Coolify.
- **PostgreSQL dedicado** (container separado no mesmo Coolify) para persistência das sessões Evolution — NÃO usar o Supabase do Nexus para isso. Isolamento total.
- **Redis** (container) para cache de sessões e filas internas da Evolution.
- **Domínio dedicado**: `evolution.sistemanexus.app` (subdomínio apontando pra VPS, SSL via Coolify).

**Por que não Railway/Render:** custo escala mal com WebSockets persistentes (uma conexão viva por corretor 24/7). VPS + Coolify dá controle total, custo fixo previsível e escala vertical até ~300 sessões antes de precisar sharding.

**Por que Coolify e não Docker puro:** UI para restart de instâncias travadas, logs por container, backup automático do Postgres, deploy de nova versão em 1 clique. Reduz tempo de manutenção de horas para minutos.

**Escalabilidade futura:** quando passar de ~250 sessões ativas, subir uma segunda VPS Evolution e usar o campo `evolution_server_url` (já previsto na tabela) para rotear novos usuários pra ela. Sem refactor no Nexus.

## 2. Modelo de dados (Supabase / Nexus)

Tabelas novas em `public`:

- **`whatsapp_sessions`** — 1 por usuário. Vincula `user_id` → `instance_name` (nome único na Evolution). Guarda `status`, `phone_number`, `profile_name`, `profile_pic_url`, `last_sync_at`, `evolution_server_url` (multi-VPS-ready), `qr_code` (temporário).
- **`whatsapp_messages`** — histórico persistente. Colunas: `lead_id` (FK vendas_leads/leads), `session_user_id`, `direction` (in/out), `message_type` (text/audio/image/video/document/location/call), `content` (texto), `media_url` (Supabase Storage), `media_mime`, `evolution_message_id` (idempotência), `status` (sent/delivered/read/failed), `sent_at`, `raw_payload` (jsonb).
- **`whatsapp_contacts_cache`** — cache `phone_e164` → `lead_id` por usuário. Acelera o roteamento do webhook (achar o lead certo em O(1)).

Bucket Storage novo: **`whatsapp-media`** (privado, RLS por lead).

**RLS** espelha as regras já validadas de `vendas_leads`:
- Corretor: só mensagens de leads onde `responsavel_id = auth.uid()`.
- Executivo: leads dos corretores da sua equipe (usa mesmas funções já existentes).
- Admin: tudo.
- Função `public.can_user_view_lead_conversation(lead_id)` reutilizando helpers atuais.

**Realtime** habilitado em `whatsapp_messages` e `whatsapp_sessions`.

## 3. Fluxo de vinculação conversa ↔ lead (regra crítica)

Webhook Evolution → `/api/public/hooks/evolution` recebe TODO evento de TODA instância. Fluxo:

```text
mensagem chega → normalizar telefone (helper phone.ts já existe) →
  buscar em vendas_leads/leads onde telefone match E responsável = dono da sessão →
    ACHOU → grava whatsapp_messages + timeline do lead + realtime
    NÃO ACHOU → descarta silenciosamente (não cria lead, não grava nada)
```

Isso garante que a Central seja 100% comercial. Conversas pessoais, grupos e fornecedores nunca entram no banco.

**Transferência de lead:** como a RLS filtra pelo `responsavel_id` atual do lead (não pelo dono da sessão que originalmente recebeu), no instante que muda o responsável, o corretor antigo perde acesso e o novo passa a ver — histórico intacto porque as mensagens ficam ancoradas no `lead_id`, não no user.

## 4. Fase 1 — Conexão WhatsApp por usuário

**Backend (server functions em `src/lib/whatsapp.functions.ts`):**
- `createWhatsappInstance()` — cria instância na Evolution (`POST /instance/create`), grava row em `whatsapp_sessions`.
- `getWhatsappQrCode()` — busca QR base64 (`GET /instance/connect/{instance}`).
- `getWhatsappStatus()` — status atual + refresh de nome/foto/telefone.
- `disconnectWhatsapp()` — `DELETE /instance/logout/{instance}` + limpa sessão.
- `deleteWhatsappInstance()` — desconecta e apaga instância.

**Server route:** `src/routes/api/public/hooks/evolution.ts` (webhook único, valida `apikey` header + assinatura).

**Segredos (via `add_secret`):** `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (chave global admin), `EVOLUTION_WEBHOOK_SECRET`.

**UI:** `src/routes/_authenticated/configuracoes.tsx` ganha aba **Integrações → WhatsApp** com:
- Card de status (conectado/desconectado/aguardando QR).
- Foto de perfil, nome, telefone, última sincronização.
- Modal com QR Code (polling de status a cada 2s até conectar, então fecha sozinho).
- Botões Conectar / Reconectar / Desconectar.
- Reconexão automática detectada via realtime em `whatsapp_sessions`.

## 5. Fase 2 — Central de Conversas

**Rota nova:** `/conversas` (adiciona no menu lateral, respeitando papel do usuário).

**Layout (desktop 2 colunas, mobile stack):**

```text
┌──────────────┬────────────────────────────────┐
│ Lista leads  │  Cabeçalho (lead + termômetro) │
│ com última   ├────────────────────────────────┤
│ msg + badge  │  Timeline de mensagens         │
│ não lida     │  (bubbles in/out, mídia inline)│
│              ├────────────────────────────────┤
│              │  Composer + anexos + Laura     │
└──────────────┴────────────────────────────────┘
```

**Lista lateral:** query em `whatsapp_messages` agrupado por `lead_id`, ordenado por última mensagem, filtro por RLS já cuida do escopo por papel. Realtime em INSERT invalida.

**Timeline:** bubbles com áudio player, imagens/vídeos inline, documentos como card clicável, status ✓/✓✓/✓✓ azul.

**Composer:**
- Textarea (Enter envia, Shift+Enter quebra linha).
- Botão anexo → dropzone drag-and-drop, preview antes de enviar, barra de progresso via Storage upload.
- Botão gravar áudio (MediaRecorder API → webm/ogg → Storage → Evolution).
- Botão emoji (`emoji-picker-element`).
- Botão templates com search inline (usa `mensagem_templates` existente).
- Botão ✨ **Responder com Laura** — chama `sophia.functions.ts` com contexto da conversa + lead + imóvel; retorna 3 sugestões clicáveis que preenchem o composer.

**Envio:** server fn `sendWhatsappMessage({leadId, type, content, mediaUrl?})` → grava row `whatsapp_messages` com `status=pending` → chama Evolution → atualiza status. Realtime propaga.

**Timeline do Lead:** hook em `whatsapp_messages` INSERT dispara log em `lead_historico` (Timeline existente ganha eventos de whatsapp automaticamente).

## 6. Segurança

- Cada instância Evolution nomeada como `nexus_{user_id}` — impossível colidir.
- Webhook valida header `apikey` contra `EVOLUTION_WEBHOOK_SECRET` (timing-safe compare).
- RLS em `whatsapp_messages` e `whatsapp_sessions` scoped por `auth.uid()` + funções de equipe.
- Bucket `whatsapp-media` privado, signed URLs de 1h para exibição.
- QR Code nunca persistido além da conexão (limpa após `status=connected`).
- Filtro de grupos (`@g.us`) e broadcasts descartados no webhook antes de qualquer processamento.

## 7. Escalabilidade (preparado, não implementado agora)

- Coluna `evolution_server_url` em `whatsapp_sessions` → multi-VPS sem refactor.
- `whatsapp_messages.raw_payload` guarda o evento cru → novos tipos (reação, enquete, chamada) só precisam de renderer novo, sem migração.
- Índices em `(lead_id, sent_at desc)` e `(session_user_id, sent_at desc)`.
- Idempotência via `evolution_message_id UNIQUE` → webhook pode ser reentrante sem duplicar.
- Estrutura pronta para Fase 3+ (Laura autônoma, campanhas, distribuição automática) apenas plugando em cima dessa base.

## 8. O que preciso de você antes de começar

1. **Confirmar a stack** (VPS Hetzner + Coolify + Evolution v2) ou dizer qual VPS já usa.
2. Depois da VPS pronta e Evolution instalada, você me passa `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` — eu salvo via `add_secret` e começo a Fase 1.
3. Se quiser, posso te entregar um **guia passo-a-passo de setup da VPS** (comandos exatos para instalar Coolify + Evolution + Postgres + apontar DNS + SSL) em um turno separado, antes de qualquer código no Nexus.

## 9. Ordem de execução após aprovação

1. Guia de setup da VPS (se pedir).
2. Migração SQL (tabelas, RLS, realtime, bucket, funções).
3. Fase 1 completa (backend + UI + webhook base) — validar conectando 1 número real.
4. Fase 2 completa (Central + composer + Laura + timeline) — validar com 1 lead real.
5. Rollout para os corretores.
