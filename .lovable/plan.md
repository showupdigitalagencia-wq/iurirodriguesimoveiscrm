## Diagnóstico

Hoje, ao mover um lead de Vendas para a etapa **Fechado**, abre o `FecharLeadDialog`, que chama `listImoveisParaFechamento` no servidor. Esse server function **filtra por finalidade** (`venda` se o lead é compra, `locacao` se é locação). Por isso a lista parece incompleta — só aparecem imóveis marcados com a finalidade compatível.

Você quer ver **todos os imóveis cadastrados** para escolher livremente.

## O que vou alterar

### 1. `src/lib/fechamento.functions.ts`
- Remover o filtro `.in("finalidade", [...])` em `listImoveisParaFechamento`.
- Manter `finalidade` no retorno (já vem) para o front exibir como badge.
- Aumentar `limit` de 500 para 2000 (segurança — hoje vocês têm ~34 imóveis ativos, mas evita corte futuro).
- Manter ordenação por `codigo`.

### 2. `src/components/fechar-lead-dialog.tsx`
- Lista passa a mostrar **todos** os imóveis; busca continua filtrando por código, bairro e tipo.
- Adicionar **badge de finalidade** ao lado do código (Venda / Locação / Venda+Locação) para o usuário saber o que está escolhendo.
- Ajuste no cálculo de comissão e no aviso de "valor não cadastrado":
  - Lead de **compra**: usa `valor_venda` (6%). Se o imóvel selecionado não tiver `valor_venda`, mostra aviso e bloqueia confirmação (como já faz hoje).
  - Lead de **locação**: usa `valor_aluguel` (1 aluguel cheio). Mesma regra de aviso/bloqueio.
- Aumentar o teto visível de 50 para 100 itens (busca continua sendo o caminho principal para listas grandes).

### 3. Regras de comissão e RPC `fechar_lead_vendas`
- **Não mudar.** A RPC já calcula com base no `tipo` do lead + valores do imóvel, independente da finalidade cadastrada. Como o gate de "valor faltando" fica no front, não há risco de gerar comissão zerada.

## O que NÃO muda
- RLS, políticas, triggers, webhooks.
- Receita de Administração (12%) e relatórios.
- Fluxo de mudança de etapa no Kanban — só o conteúdo do modal.

## Validação
- Abrir um lead de **compra** → mover para Fechado → lista deve trazer imóveis de venda **e** de locação; selecionar um sem `valor_venda` deve mostrar aviso e desabilitar "Confirmar".
- Abrir um lead de **locação** → mesmo teste com `valor_aluguel`.
- Confirmar fechamento em um imóvel válido → comissão registrada igual à de hoje.

Confirma que sigo com essa implementação?
