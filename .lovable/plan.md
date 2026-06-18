## Escopo

Email fica fora. Tudo o resto da feature de captação de corretores, ponta a ponta.

## 1. Banco (1 migration)

- `candidatos` (tabela nova):
  - dados pessoais: nome, cpf, telefone, email, creci, regiao (enum `lead_regiao`)
  - links dos 4 docs no Storage: `rg_path`, `cpf_path`, `creci_path`, `comprovante_path`
  - `status`: `pendente_revisao` | `arquivado`
  - `lead_id` (FK opcional pra `leads`), `responsavel_id` (executivo da região)
  - `drive_folder_id`, `arquivado_em`, `arquivado_por`
  - RLS: leitura/escrita apenas Admin + Administrativo
- `configuracoes`: adicionar chave `vsl_youtube_url` (texto)
- `regiao_responsavel` (tabela de mapa): `regiao` (enum) → `responsavel_id`. Seed inicial:
  - `barra_da_tijuca` → Robson
  - `recreio` → Fabíola
  - `belford_roxo` → Renata
  - `nilopolis` → Denise
  - `mesquita` → Denise
  - (demais regiões caem em Admin/Iuri como fallback)
- Storage bucket privado `candidatos-docs` + políticas (insert público anônimo restrito ao path do próprio candidato; leitura Admin/Administrativo)

## 2. Landing page pública `/ingresso`

Rota top-level, sem login, SSR. Visual preto/dourado.
Seções: logo → headline "Bem-vindo à primeira etapa do Sistema Nexus" → vídeo VSL (iframe YouTube, URL vinda de `configuracoes.vsl_youtube_url`) → benefícios → estatísticas → formulário.

Formulário: nome, CPF, WhatsApp, email, CRECI, região (select), upload de 4 arquivos (RG, CPF, CRECI, comprovante).

## 3. Server function pública `submeterCandidato`

- valida com Zod
- upload dos 4 arquivos para `candidatos-docs` via `supabaseAdmin` (rota pública, sem sessão)
- procura lead em `leads` por telefone OU CPF (canal corretor)
- se achar: atualiza dados, move `etapa = documentos_enviados`, mantém `responsavel_id` existente
- se não achar: cria lead com `responsavel_id = regiao_responsavel[regiao]`, `etapa = documentos_enviados`, `canal = indicacao`, `is_corretor = true`
- cria row em `candidatos` linkada ao lead
- dispara push OneSignal pra: Larissa (Administrativo), Iuri e Wederson (Admin), + executivo da região
  - título: "📄 Novo candidato enviou documentação!"
  - mensagem: "Nome: {nome} | Região: {regiao}"

## 4. Tela `/administrativo/candidatos`

Rota `_authenticated/admin.candidatos.tsx`, visível Admin + Administrativo.
- lista: nome, data envio, região, status (badge)
- filtros: status (Pendente / Arquivado / Todos)
- ao clicar → drawer com:
  - dados completos
  - 4 documentos com botões Visualizar / Baixar (signed URL do Storage)
  - link pro lead vinculado no pipeline de captação
  - botão **"Salvar no Google Drive"**

## 5. Botão "Salvar no Drive"

Server function autenticada (`requireSupabaseAuth`):
- usa o token Google do **usuário logado** (Larissa, quando ela clica) — reaproveita `drive.server.ts`
- cria pasta `Captação Corretores / {nome do candidato}`
- baixa os 4 arquivos do Storage e faz upload pro Drive
- salva `drive_folder_id` no candidato
- marca `status = arquivado`, `arquivado_em = now()`, `arquivado_por = uid`
- registra docs em `documentos` (mesma tabela do módulo Admin)

## 6. Config admin (campo VSL)

Em `/configuracoes`, seção Admin: input "Link do vídeo VSL (YouTube)" que grava em `configuracoes.vsl_youtube_url`. Server function `setVslUrl` (apenas Admin).

## 7. Sub-aba "Landing Page" (Executivos + Admin)

Rota `_authenticated/executivos.landing-page.tsx` (ou aba dentro de `/executivos`):
- preview embed da LP via `<iframe src="/ingresso">`
- link público em destaque: `https://iurirodriguesimoveiscrm.lovable.app/ingresso`
- botão "Copiar link"
- botão "Enviar via WhatsApp" → abre `wa.me/?text=...` com mensagem pronta

## Fora do escopo agora

- Email para Larissa (adiar até resolver DNS)
- Edição da página de Configurações de mapa região→responsável via UI (vai por seed; se quiser editar depois, fazemos uma telinha)

## Ordem de execução

1. Migration (DB + bucket + seed)
2. Aguarda aprovação da migration
3. Server functions + LP + Candidatos + Drive + Config + Sub-aba (tudo em paralelo no mesmo turno)

## Pergunta

Posso seguir? Só preciso confirmar: **regiões não mapeadas (jacarepaguá, zona sul, zona norte, zona oeste, centro, outras) caem no Iuri (Admin)** ou prefere round-robin entre os 4 executivos cadastrados?
