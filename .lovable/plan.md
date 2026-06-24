## Objetivo
Criar a tela **Hoje** — central de ações do dia que apenas **consulta e agrega** dados de módulos já existentes, sem duplicar lógica. Acesso por ícone no header (não no menu principal), com badge de itens urgentes.

---

## Fase 1 — Estrutura base + posicionamento do ícone

**Rota nova:** `src/routes/_authenticated/hoje.tsx`

**Ícone no header:**
- Identificar o header atual (mobile topbar + desktop) onde estão Notificações, Configurações, Sair.
- Adicionar ícone `Zap` (ou `Sparkles`) com badge numérico — mesmo padrão visual do badge de notificações não lidas.
- Click → navega para `/hoje`.
- O contador vem de um hook novo `useHojeBadge()` que soma os itens urgentes (query leve, só `count`).

**Layout da tela `/hoje`:**
- Cabeçalho com data + saudação.
- Render condicional de seções (oculta se vazia).
- Empty state global: *"Tudo em dia! Nenhuma ação pendente agora."*

---

## Fase 2 — Seções de Vendas (Corretor/Executivo/Admin)

Cada seção é um componente isolado em `src/components/hoje/` que usa `useQuery` + canais Realtime sobre tabelas já existentes. **Nenhuma RPC nova, nenhuma alteração de schema.**

1. **`PlantaoStatusBanner`** — consulta `plantao_escala` do dia atual para o `user.id`. Se ativo, mostra banner no topo.

2. **`LeadsSemPrimeiroContato`** — `vendas_leads` atribuídos pelo plantão (`origem_plantao = true` ou campo equivalente já existente) sem `primeiro_contato_em`, com contador ao vivo do tempo restante até escalonar (baseado nas regras de SLA já configuradas). Botão "Responder agora" → abre WhatsApp/lead (reaproveita o handler já existente em `vendas-lead-detail`).

3. **`VisitasHoje`** — `vendas_visitas` com `data_hora` entre início e fim de hoje, ordenadas. Botões:
   - "Ver lead" → navega para o lead
   - "Retirar chave" (se imóvel tem chave e ainda disponível) → reaproveita ação de `chaves_log`
   - Se horário passou: "Realizada / Não compareceu" → mesma mutação já existente.

4. **`FollowUpVencendoHoje`** — leads (vendas + captação) cujo `dias_na_etapa` == limite configurado da etapa **hoje**. Botão "Usar Template" reaproveita `mensagem_templates`.

5. **`ChavesAtrasadas`** — `chaves_log` em aberto onde `retirada_em + limite_dias < now()`. Botão "Devolver agora" reaproveita mutação atual.

**Escopo de visibilidade** aplicado nas queries:
- Corretor: `eq('responsavel_id', user.id)` / `eq('corretor_id', user.id)`.
- Executivo: itens próprios de Vendas (mesma regra do corretor).
- Admin: itens próprios apenas.

---

## Fase 3 — Seção de Captação (somente Executivo)

6. **`CaptacaoCandidatosSemContato`** — `candidatos` da região do executivo (via `regiao_responsavel`) sem contato há X dias (mesmo limite já configurado).
7. **`ReunioesInstitucionaisHoje`** — `reunioes` de hoje + `reuniao_participantes` confirmados.

Gate: só renderiza se `role === 'executivo'`.

---

## Fase 4 — Realtime + badge

- Cada seção abre um canal Realtime nas tabelas relevantes (postgres_changes), invalidando o respectivo `queryKey`.
- O hook `useHojeBadge` escuta os mesmos eventos para atualizar o contador no header.
- Cleanup em `useEffect` return — sem leaks.

---

## Detalhes técnicos

- **Sem migrations** — todas as tabelas e campos já existem.
- **Server functions**: criar `src/lib/hoje.functions.ts` com queries autenticadas (`requireSupabaseAuth`) — uma por seção, retornando DTOs serializáveis.
- **Componentes**: glassmorphism + tokens navy/dourado (já no design system).
- **Mobile**: ícone na topbar existente; desktop: ícone equivalente no header.
- **Permissões/RLS**: as queries usam `supabase` do middleware, então RLS já filtra. Escopo adicional é só para evitar trazer dados que o usuário pode ver mas não interessam aqui.

---

## Ordem de entrega

1. Fase 1 + Fase 2 (estrutura, ícone+badge, 5 seções de Vendas, Realtime, empty state).
2. Fase 3 (Captação para Executivo) — em turno seguinte após confirmação.

Confirma para eu começar pela Fase 1 + 2?
