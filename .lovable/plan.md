
# Stories no Feed + Polimento Instagram

Vou entregar em **3 fases sequenciais**, começando pela estrutura de Stories como você pediu. Nada do feed atual (postar, curtir, comentar, moderação) é alterado — Stories é uma camada nova em paralelo.

---

## Fase 1 — Backend de Stories (estrutura + expiração 24h)

**Tabelas novas** (`public`, com GRANTs + RLS):
- `feed_stories` — story de cada usuário
  - `author_id`, `image_path` (Storage), `caption?`, `created_at`, `expires_at` (default `now() + 24h`), `hidden_at`, `hidden_by`
- `feed_story_views` — quem viu cada story
  - `story_id`, `viewer_id`, `viewed_at` — único por (story, viewer)

**RLS:**
- SELECT: qualquer autenticado vê stories **não expirados e não ocultos** (admin vê tudo).
- INSERT: autor = `auth.uid()`.
- DELETE/UPDATE (ocultar): autor OU admin (`has_role`).
- `feed_story_views`: INSERT pelo próprio viewer; SELECT do autor do story + admin (para a lista "visto por").

**Storage:** reutiliza o bucket `feed` já existente, em pasta `stories/{user_id}/...`.

**Expiração:** filtro `expires_at > now()` em toda leitura. Limpeza física opcional via cron (não-bloqueante; pode ficar para depois).

---

## Fase 2 — UI de Stories (barra + viewer fullscreen + visualizações)

**Componentes novos** em `src/components/feed/`:
- `stories-bar.tsx` — barra horizontal no topo do Feed
  - Primeiro item: avatar do usuário logado com botão **+** (abre uploader)
  - Demais: avatares de quem tem story ativo nas últimas 24h, agrupados por autor
  - Anel **dourado** (gradiente navy→gold) quando há story **não visto**; anel **cinza** quando tudo já foi visto pelo usuário
  - Realtime: subscribe em `feed_stories` e `feed_story_views`
- `story-viewer.tsx` — overlay fullscreen estilo Instagram
  - Barras de progresso no topo (uma por story do autor atual)
  - Auto-avanço a cada **6s**; tap avança, tap-segurar pausa, swipe down/left fecha
  - Ao terminar o último story do autor, pula para o próximo autor da fila
  - Marca visualização (`feed_story_views` upsert) quando o story entra em foco
  - Botão "visto por N" (só autor/admin) abre lista de nomes
  - Menu `…`: excluir (autor/admin) + aviso de protocolo
- `story-upload-dialog.tsx` — selecionar foto + legenda curta opcional; mesmo banner de protocolo do feed
- `story-views-sheet.tsx` — sheet com lista "Visto por: Robson, Ana, Carlos…"

Integração em `src/routes/_authenticated/inicio.tsx`: monta `<StoriesBar />` logo abaixo do header, antes do composer e da lista de posts. Nada mais do arquivo é tocado nesta fase.

---

## Fase 3 — Polimento visual do Feed (sem mudar lógica)

Apenas em `inicio.tsx`, camada visual:
- Avatares circulares maiores, com anel sutil; nome em destaque + "há 2h" discreto
- Foto do post sem padding lateral (`-mx-` no card), aspect mais cinematográfico (até `aspect-[4/5]`)
- Ações: ícones maiores (coração preenche em dourado/rose ao curtir, balão de fala), contadores abaixo no estilo "23 curtidas"
- Legenda com prefixo do nome do autor inline (estilo IG)
- Comentários colapsados com "Ver todos os N comentários"
- Tudo dentro da paleta navy + dourado já vigente

Lógica de curtir/comentar/moderação/excluir/ocultar permanece **idêntica**.

---

## Detalhes técnicos

- **Migração** roda primeiro (Fase 1), aprovada por você, e regenera `types.ts`. Só depois escrevo a Fase 2.
- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE feed_stories, feed_story_views`.
- **Viewer fullscreen:** componente client-only com `requestAnimationFrame` para a barra de progresso (não usa timer drift).
- **Acessibilidade:** botões com `aria-label`, foco visível, ESC fecha o viewer.
- **Moderação admin:** mesmo padrão do feed — `has_role` + dropdown no story.
- **Protocolo:** banner reaproveitando o aviso já existente do composer do feed.

---

Confirme a Fase 1 para eu disparar a migração; ao aprovar a migração, sigo direto para Fase 2 e depois Fase 3.
