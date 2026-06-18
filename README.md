# Iuri Rodrigues Imóveis — CRM

CRM imobiliário construído na Lovable (TanStack Start + React 19 + Vite 7 + Tailwind v4) com backend Supabase (Lovable Cloud).

## Stack

- **Frontend:** TanStack Start v1, React 19, Vite 7, TypeScript estrito, Tailwind CSS v4, shadcn/ui, TanStack Query, TanStack Router (file-based routing)
- **Backend (Lovable Cloud / Supabase):** Postgres + RLS, Auth, Storage, Edge Functions
- **Server logic:** `createServerFn` do `@tanstack/react-start` (não usar Edge Functions para lógica interna do app)
- **Integrações:**
  - Google OAuth (login + Google Calendar/Meet para reuniões institucionais)
  - OneSignal (push notifications)
  - Evolution API / Z-API (WhatsApp)
  - Cora (boletos / banking)
  - Lovable AI Gateway (modelos de IA)

## Estrutura de pastas

```
src/
├── routes/                       # File-based routing (TanStack)
│   ├── __root.tsx                # Layout raiz
│   ├── index.tsx                 # Home
│   ├── ingresso.tsx              # Landing pública /ingresso
│   ├── auth.tsx                  # Login
│   ├── _authenticated/           # Rotas protegidas (gate auto)
│   │   ├── admin.imoveis.tsx
│   │   ├── configuracoes.tsx
│   │   └── ...
│   └── api/public/               # Webhooks / cron públicos
│       └── cron-reunioes-institucionais.ts
├── components/                   # Componentes UI reutilizáveis
├── hooks/                        # React hooks
├── lib/                          # Server functions (*.functions.ts) e utils
├── integrations/supabase/        # Cliente Supabase (auto-gerado, não editar)
├── styles.css                    # Tailwind v4 + tokens semânticos
└── start.ts                      # Middleware global do TanStack Start

supabase/
├── migrations/                   # SQL migrations (schema, RLS, triggers, functions)
└── functions/
    └── cora-proxy/               # Edge Function (proxy Cora)
```

## Variáveis de ambiente / Secrets

Configurados em **Lovable Cloud → Settings → Secrets** (nunca commitar valores):

### Públicas (frontend — `VITE_*`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Backend / server-only
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWKS`
- `SUPABASE_DB_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN`
- `CORA_API_KEY`
- `CORA_CNPJ`
- `LOVABLE_API_KEY` (Lovable AI Gateway)

## Edge Functions

- `cora-proxy` — proxy autenticado para a API do banco Cora (boletos)

> Restante da lógica de servidor está em `src/lib/*.functions.ts` (TanStack Server Functions) e em `src/routes/api/public/*` (webhooks/cron).

## Rodar localmente

```bash
git clone <URL_DO_REPO>
cd <pasta>
bun install            # ou: npm install
cp .env.example .env   # preencher VITE_SUPABASE_* + secrets server-only
bun run dev            # Vite em http://localhost:8080
```

Para aplicar o schema num Supabase próprio:

```bash
# Opção 1: Supabase CLI
supabase db push

# Opção 2: rodar o consolidado
psql "$SUPABASE_DB_URL" -f schema-completo.sql
```

## Banco de dados (resumo)

- `profiles`, `user_roles` (enum `app_role`: admin / corretor / administrativo)
- `leads`, `lead_historico`, `vendas_leads`
- `imoveis` (com sequence `imoveis_codigo_seq` + trigger `imoveis_set_codigo`)
- `reunioes`, `reuniao_participantes` (institucional / individual / mentoria)
- `candidatos` (recrutamento via `/ingresso`)
- `responsaveis`, `configuracoes`
- RLS habilitada em todas as tabelas públicas. Funções `has_role`, `current_user_*`, `can_user_view_reuniao`, `can_view_candidatos` controlam acesso.

Schema completo: `schema-completo.sql` (consolidado de todas as migrations).

## Principais módulos

1. **Leads & Funil de Vendas** — CRM com etapas, histórico, distribuição por responsável
2. **Imóveis** — cadastro com código sequencial automático (`IM-0001`), fotos (bucket `imoveis-fotos`), status (Disponível/Locado/Vendido/etc.)
3. **Reuniões institucionais** — integração Google Calendar/Meet via OAuth, cron diário (`/api/public/cron-reunioes-institucionais`)
4. **Recrutamento (`/ingresso`)** — VSL com gate (libera formulário após assistir o vídeo), upload de docs (bucket `candidatos-docs`)
5. **Financeiro Cora** — boletos via Edge Function `cora-proxy`
6. **WhatsApp** — disparo via Z-API/Evolution
7. **Push** — notificações OneSignal
8. **Configurações & Admin** — gestão de usuários, papéis, responsáveis, parâmetros

## Sincronização com GitHub

Conecte pelo botão **GitHub** no menu **+** (canto inferior esquerdo do chat Lovable) → *Connect project*. Após conectar, todo commit feito na Lovable é empurrado pro repo, e todo push pro repo é refletido aqui (sync bidirecional).
