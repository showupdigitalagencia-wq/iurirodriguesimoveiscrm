## Sequência proposta

Vou implementar em 5 fases independentes, na ordem do menor ao maior risco/dependência. Cada fase é entregue e validada antes da próxima.

---

### Fase 1 — Compartilhar Imóvel em 1 toque (mais simples, frontend puro)

**Por que primeiro:** não exige migração de banco nem cron. É só montar texto + `wa.me/?text=...` a partir de dados que já existem em `imoveis`.

- Botão "Compartilhar" no card e detalhe do imóvel em `vendas.portfolio.tsx` e `admin.imoveis.tsx`.
- Helper `buildImovelShareMessage(imovel)` monta: tipo, endereço, valor, quartos/banheiros/vagas, link da Vitrine, até 3 URLs de fotos principais (WhatsApp expande links de imagem).
- Abre `https://wa.me/?text=<encoded>` em nova aba.

---

### Fase 2 — Checklist de Visita (configuração simples + UI)

- Nova chave em `configuracoes`: `checklist_visita` (array de strings). Admin edita em `Configurações → Admin`.
- No diálogo "Confirmar Visita Realizada" (`vendas-visitas` / `ConfirmarVisitaDialog`), renderizar o checklist com checkboxes locais (estado só visual, não persistido). Não bloqueia confirmação.

---

### Fase 3 — Templates de WhatsApp

**Migração:**
- Tabela `mensagens_templates` (id, nome, categoria, corpo, ativo, created_at/updated_at).
- GRANT: `SELECT` para `authenticated` (todos usam); `ALL` para `service_role`. RLS: `SELECT` para qualquer authenticated; `INSERT/UPDATE/DELETE` só se `has_role(uid,'admin')`.

**UI:**
- Admin: aba "Templates de Mensagens" em Configurações com CRUD.
- Lead detail (Captação + Vendas): botão "Usar Template" → modal lista templates → substitui `{nome_lead}`, `{nome_corretor}`, `{endereco_imovel}`, `{valor}`, `{data_visita}` com `vendas_leads`/`leads` + perfil + visita futura mais próxima → abre `wa.me/<telefone>?text=...`.
- Helper `renderTemplate(corpo, ctx)` centralizado.

---

### Fase 4 — Alerta de Follow-up Esquecido

- Chave em `configuracoes`: `followup_alerta_dias` (default 5). Admin edita.
- Coluna `followup_alerta_em timestamptz` em `vendas_leads` e `leads` para evitar repetição (mesma lógica da reativação).
- Cron `/api/public/hooks/followup-alerta` (1x/dia): seleciona leads em etapa `follow_up` cujo `updated_at < now() - X dias` e `followup_alerta_em IS NULL OR followup_alerta_em < updated_at`. Dispara push OneSignal ao responsável e marca `followup_alerta_em = now()`. Qualquer movimentação do lead (já atualiza `updated_at`) reabre a janela naturalmente.

---

### Fase 5 — Conquistas / Badges (maior superfície)

**Migração:**
- `conquistas_catalogo` (seed estática: codigo, titulo, descricao, icone, regra).
- `conquistas_usuario` (user_id, codigo, desbloqueada_em, periodo_ref `YYYY-MM` ou `YYYY-Www`, unique(user_id, codigo, periodo_ref)).
- RLS: `SELECT` para qualquer authenticated (perfis já são visíveis seguindo regras existentes); writes só `service_role`.

**Cron `/api/public/hooks/conquistas-check` (diário + segunda-feira para semanal):**
- `vendas_5/10/20_mes`, `locacoes_5/10/mes` → agrupa `vendas_leads` fechado por `corretor_id` no mês atual.
- `meta_batida` → cruza `metas_mensais` com fechamentos.
- `resposta_mais_rapida_semana` → menor `AVG(atribuido_em - created_at)` da semana anterior entre corretores ativos.
- A cada novo `INSERT` em `conquistas_usuario`, inserir post no `feed_posts` com `author_id = system` (ou autor = user; com flag `auto_conquista = true` para impedir edição pelo dono — só admin oculta).

**UI:**
- Seção "Conquistas" no perfil (`profile.tsx`) listando badges desbloqueados com ícone + data.
- Badge especial no card do feed quando `auto_conquista = true`.

---

## Sobre WhatsApp / `wa.me`

Tudo "abrir WhatsApp" usa `https://wa.me/<telefone>?text=<encoded>` (ou sem telefone para escolher contato). Funciona em mobile e desktop sem integração de API.

## Confirmar antes de começar

Posso seguir com a **Fase 1** (Compartilhar Imóvel)?
