
Não identifiquei nenhum erro na mensagem — interpretei como pedido de implementação. Abaixo o plano para a **Fase 1** do Feed (estrutura básica, sem gatilhos automáticos ainda).

## Escopo Fase 1

- Nova aba **Início** vira tela padrão pós-login (Dashboard mantido intacto, só deixa de ser default).
- Feed cronológico (mais recentes primeiro), visível a todos os perfis logados.
- Post manual: foto + legenda + aviso de protocolo.
- Curtir (toggle, contador) e Comentar.
- Moderação: Admin oculta/remove qualquer post, ação registrada em `audit_log`.
- Mostra autor (nome + avatar) e data/hora.

## Fora desta fase (Fase 2)

- Gatilhos automáticos: Retirada/Devolução de Chave, Lead Fechado com foto, Pós-reunião com foto. Serão plugados quando esses módulos existirem (basta inserir em `feed_posts` com `source` = 'chave' | 'entrega' | 'reuniao').

## Backend (migration)

```
feed_posts
  id uuid pk
  author_id uuid → auth.users
  caption text
  image_path text         -- storage path em bucket "feed"
  source text default 'manual'    -- manual|chave|entrega|reuniao
  source_ref uuid null            -- referência opcional ao registro origem
  hidden_at timestamptz null
  hidden_by uuid null
  created_at timestamptz default now()

feed_likes (post_id, user_id) pk composto
feed_comments (id, post_id, author_id, body, created_at)
```

- Bucket Storage `feed` (privado), policies: authenticated read; insert do próprio user; admin update/delete.
- RLS:
  - `feed_posts` SELECT authenticated WHERE `hidden_at IS NULL` OR `has_role(uid,'admin')`.
  - INSERT authenticated com `author_id = auth.uid()`.
  - UPDATE/DELETE: autor ou admin.
  - Likes/comments: SELECT authenticated; INSERT próprio user; DELETE próprio user ou admin.
- GRANTs padrão para `authenticated` + `service_role` em todas as tabelas novas.
- Trigger em UPDATE de `feed_posts.hidden_at`: insere linha em `audit_log` com ação `feed_post_hidden`.

## Frontend

- Rota: `src/routes/_authenticated/inicio.tsx` (novo) — componente `FeedPage`.
- Após login, redirect default → `/inicio` (ajusta `_authenticated/index.tsx` ou ponto de entrada equivalente). Dashboard segue acessível em sua rota atual.
- Adiciona item "Início" no menu lateral, no topo, antes de "Dashboard".
- Componentes em `src/components/feed/`:
  - `FeedList.tsx` — lista paginada (react-query, ordem desc por `created_at`).
  - `FeedPostCard.tsx` — avatar, nome, data, imagem, legenda, botões Curtir/Comentar, menu "..." (autor: excluir; admin: ocultar).
  - `NewPostDialog.tsx` — botão "+ Postar", upload de foto, textarea de legenda, banner amarelo com o protocolo exato pedido.
  - `CommentsSheet.tsx` — lista comentários + input.
- Imagens: upload direto via supabase-js do client para bucket `feed` em path `${user.id}/${uuid}.jpg`; salva path no post; renderiza via `createSignedUrl` ou public URL conforme bucket.
- Curtir: optimistic update.

## Regras visuais

- Reaproveita tokens existentes do sistema (não é a LP `/seja-corretor`); mantém estética atual do app autenticado, sem variações novas.

## Não toca

- Dashboard, webhooks Meta/Evolution, pipeline de vendas, RPCs, RLS existentes, lógica de criação de lead, plantão.

Confirma para eu executar a Fase 1?
