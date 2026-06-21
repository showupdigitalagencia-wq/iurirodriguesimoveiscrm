## Objetivo

Deixar todas as funções do Sistema NEXUS totalmente utilizáveis no celular, mantendo o desktop intacto. A navegação principal (sidebar + bottom bar + "Mais") já existe — o trabalho agora é adaptar cada **tela interna** (tabelas, kanban, formulários, modais e dashboards) para fluir bem em telas pequenas.

## Princípios aplicados em todas as telas

- Nenhuma tabela "estoura" lateralmente: viram cards empilhados no mobile (`md:hidden` cards / `hidden md:block` tabela).
- Todo Dialog/Sheet vira tela cheia no mobile, com botões grandes (mín. 44px) e rolagem interna.
- Cabeçalhos de página: título + ações usam `grid` no mobile e `flex` no desktop (sem botões cortados).
- Kanban (Pipeline) ganha modo "swipe horizontal por etapa" no mobile com indicador de etapa.
- Gráficos do dashboard/relatórios reduzem para 1 coluna e altura adequada no celular.
- Formulários longos (Configurações, Imóveis, Reunião, Lead) usam abas/seções colapsáveis no mobile.

## Ondas de execução

Vou entregar em **3 ondas**, validando cada uma com Playwright em viewport 390x844 antes de seguir:

### Onda 1 — Operacional do dia a dia (mais usado no celular)
- `pipeline.tsx` + `vendas.pipeline.tsx` — Kanban responsivo (swipe entre colunas)
- `leads.tsx` + `vendas.leads.tsx` — Tabela → cards no mobile, filtros em sheet
- `lead-detail-sheet.tsx` + `vendas-lead-detail.tsx` — Sheet fullscreen no mobile
- `create-lead-dialog.tsx` — Dialog fullscreen com inputs maiores
- `agenda.tsx` + `vendas.agenda.tsx` — Calendário/lista adaptada
- `reuniao-form-dialog.tsx` + `reuniao-detail-dialog.tsx` — Fullscreen mobile
- `notificacoes.tsx` — Lista já é vertical, ajustar paddings/headers
- `correspondente.tsx` — Cards + Dialog fullscreen para upload de docs

### Onda 2 — Gestão e relatórios
- `dashboard.tsx` + `vendas.index.tsx` — Cards stats 1 col, gráficos full width
- `relatorio.tsx` — Gráficos empilhados, filtros em sheet
- `corretores.tsx` — Tabela → cards no mobile
- `executivos.index.tsx` + `executivos.$id.tsx` + `executivos.landing-page.tsx` — Layout fluido
- `captacao-links.tsx` — Cards de link + preview adaptado
- `sophia-chat.tsx` — Chat full-height no mobile

### Onda 3 — Administrativo e configuração
- `admin.index.tsx`, `admin.imoveis.tsx`, `admin.contratos.tsx`, `admin.pagamentos.tsx`, `admin.inadimplentes.tsx`, `admin.candidatos.tsx` — Tabelas → cards, forms adaptados
- `configuracoes.tsx` — Seções colapsáveis/abas no mobile
- `usuarios.tsx` — Tabela → cards, dialog criar usuário fullscreen
- `tempo-acesso.tsx` — Lista/gráficos adaptados

## Detalhes técnicos

- Padrão de tabela responsiva: dentro de cada rota com tabela, adicionar bloco `<div className="md:hidden space-y-3">…cards…</div>` e envolver a `<Table>` em `<div className="hidden md:block">`. Sem refatorar lógica de dados — só apresentação.
- Padrão de Dialog mobile: usar `className="max-w-[100vw] sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg"` com `<DialogContent>` rolável.
- Kanban swipe: usar scroll-snap horizontal (`snap-x snap-mandatory`) com cada coluna `w-[85vw] md:w-72 snap-center`, sem libs extras.
- Não mexer em lógica de negócio, RLS, server functions, queries ou tipos.
- Não criar componentes novos a menos que seja para evitar duplicação (ex: um `ResponsiveTable` helper se ficar repetitivo).

## Validação

Ao final de cada onda: rodar Playwright em 390x844, navegar pelas telas da onda logado como admin, tirar screenshots e conferir que nada está cortado/cortando texto/sem botão acessível.

## Fora de escopo

- Mudar visual/tema/cores (preto e dourado mantido).
- Adicionar/remover funcionalidades.
- Mexer em backend, migrations ou permissões.
- PWA / instalação no celular (pode ser uma próxima etapa se você quiser).
