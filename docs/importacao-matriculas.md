# Fluxo de importação de alunos e matrícula em massa

Este guia descreve o fluxo ponta a ponta de importação de alunos via wizard, validação em staging, disparo da função de importação e acompanhamento de histórico/erros. Também resume como matricular os alunos importados (ou existentes) pela API/UX atual.

## Visão geral
1. **Upload autenticado**: o wizard obtém `escolaId` e `userId` da sessão Supabase e envia o CSV para `/api/migracao/upload`, que salva no bucket `migracoes` e cria um registro em `import_migrations` com `importId` real.
2. **Mapeamento + validação**: o usuário mapeia colunas no passo 2; `/api/migracao/alunos/validar` lê o arquivo, converte linhas para `staging_alunos`, limpa erros anteriores e salva `column_map`/`total_rows` na mesma `import_migrations`.
3. **Importação**: `/api/migracao/alunos/importar` chama a RPC `importar_alunos` usando `importId/escolaId`, marca a importação como `imported` e retorna um resumo (`imported`, `skipped`, `errors`).
4. **Acompanhamento**: a tela de finalização busca `/api/migracao/[importId]/erros` para listar erros linha a linha e a página de histórico consome `/api/migracao/historico` para exibir as últimas 50 importações.

## Funil de Admissão (cadastro → candidatura → matrícula)
- Cadastro rápido cria apenas `alunos` (gera `numero_processo` automático) e registra a intenção em `candidaturas` com `curso_id`/`ano_letivo`; não cria `matriculas` nem `profiles` neste passo.
- Conversão para matrícula ocorre via endpoint dedicado `/api/secretaria/candidaturas/[id]/confirmar`, que insere em `matriculas` (gera `numero_matricula` e sincroniza login/profile) e marca a candidatura como `matriculado`.
- UI de matrícula agora seleciona uma candidatura pendente/paga e, a partir dela, aloca a turma e chama o endpoint de confirmação; orçamento usa `curso_id/ano_letivo` da candidatura.

## Wizard de migração (frontend)
- **Contexto autenticado**: o wizard carrega `userId` e resolve `escolaId` no `useEffect` a partir de `app_metadata.escola_id` ou, em fallback, via `profiles.current_escola_id` → `profiles.escola_id` → `escola_usuarios.escola_id`. O upload é bloqueado sem escola válida.【F:apps/web/src/app/migracao/alunos/page.tsx†L22-L147】
- **Upload (passo 1)**: envia `file`, `escolaId` e opcionalmente `userId` para `/api/migracao/upload`; guarda `importId` retornado, limpa erros anteriores e extrai cabeçalhos do CSV para mapeamento.【F:apps/web/src/app/migracao/alunos/page.tsx†L89-L118】
- **Mapeamento + validação (passo 2)**: envia `importId`, `escolaId` e `columnMap` para `/api/migracao/alunos/validar`; na resposta, popula a pré-visualização das primeiras linhas e avança ao passo 3.【F:apps/web/src/app/migracao/alunos/page.tsx†L62-L87】
- **Importação (passo 3)**: dispara `/api/migracao/alunos/importar` com os IDs reais; após sucesso, carrega erros detalhados via `/api/migracao/[importId]/erros` e mostra o resumo retornado pela API.【F:apps/web/src/app/migracao/alunos/page.tsx†L120-L215】

## APIs do fluxo de importação
- **Upload** (`POST /api/migracao/upload`)
  - Campos obrigatórios: `file` (CSV), `escolaId`; opcional `userId` para `created_by`.
  - Valida tamanho máximo, calcula hash, garante bucket `migracoes`, salva o arquivo e insere em `import_migrations` com status `uploaded`; devolve `importId` para o frontend.【F:apps/web/src/app/api/migracao/upload/route.ts†L11-L79】

- **Validação** (`POST /api/migracao/alunos/validar`)
  - Corpo: `{ importId, escolaId, columnMap }`.
  - Baixa o CSV salvo, converte para staging com `mapAlunoFromCsv`, limpa `staging_alunos` e `import_errors` do `importId`, faz `upsert` do staging, atualiza `import_migrations` com `status: "validado"`, `total_rows` e `column_map`, e retorna `preview` + total de linhas.【F:apps/web/src/app/api/migracao/alunos/validar/route.ts†L10-L74】

- **Importação** (`POST /api/migracao/alunos/importar`)
  - Corpo: `{ importId, escolaId }`.
  - Executa a função `importar_alunos` passando o `importId` validado e atualiza `import_migrations` para `imported` com `processed_at`; responde com o resumo de importação para o wizard.【F:apps/web/src/app/api/migracao/alunos/importar/route.ts†L9-L52】

- **Erros de importação** (`GET /api/migracao/[importId]/erros`)
  - Retorna `row_number`, `column_name`, `message` e `raw_value` de `import_errors` ordenados por linha, usados no passo 4 para exibição detalhada.【F:apps/web/src/app/api/migracao/[importId]/erros/route.ts†L5-L19】

- **Histórico** (`GET /api/migracao/historico`)
  - Lista até 50 registros de `import_migrations` (arquivo, status, contagens, timestamps) para a página de histórico da UI.【F:apps/web/src/app/api/migracao/historico/route.ts†L5-L30】

## Persistência do mapeamento de colunas
Há uma migração que adiciona o campo `column_map` em `import_migrations`, permitindo auditar ou reutilizar o mapeamento usado em cada importação.【F:supabase/migrations/20251125120000_import_migrations_add_column_map.sql†L1-L2】

## Histórico e erros na UI
A página `/migracao/historico` consome a rota de histórico e renderiza cards com status, contagens e timestamps das importações recentes, substituindo os placeholders anteriores.【F:apps/web/src/app/migracao/historico/page.tsx†L1-L49】 Use essa tela para acompanhar progresso e verificar rapidamente quantos registros foram importados ou falharam.

## Matrícula de alunos (criação e atualização)
- **Listagem e filtros**: `GET /api/secretaria/matriculas` aplica escopo da escola do usuário (profiles/escola_usuarios), suporta filtros por texto, turma, status ou múltiplos status e paginação; retorna `items` e `total` para a página `/secretaria/matriculas`.【F:apps/web/src/app/api/secretaria/matriculas/route.ts†L8-L150】
- **Criação de matrícula**: `POST /api/secretaria/matriculas` resolve a escola via aluno ou perfil, valida campos obrigatórios, garante/gera `numero_login` do aluno quando necessário, cria a matrícula com status `ativo` e, se parâmetros de preço/dia não forem fornecidos, resolve mensalidade via `resolveMensalidade` antes de gerar os lançamentos financeiros.【F:apps/web/src/app/api/secretaria/matriculas/route.ts†L152-L400】
- **Atualização de status**: use `PUT /api/secretaria/matriculas/[id]/status` (não mostrado aqui) para alterar status com escopo de escola; combine com confirmações na UI para operações sensíveis.

## Formato do Código da Turma
- Use `<CURSO>-<CLASSE>-<TURNO>-<TURMA>` (ex.: `TI-10-M-A`).
- CURSO: sigla configurada pela escola (`EP`, `ESG`, `TI`, `CFB`, etc.).
- CLASSE: número 1–13. TURNO: `M` manhã, `T` tarde, `N` noite. TURMA: letra(s) (`A`, `B`, `C`...).
- Ao importar com turma preenchida, o backend resolve `course_code` da escola, usa `create_or_get_turma_by_code` para criar/pegar a turma (único por escola+ano) e então matricula. Se a sigla do curso não estiver configurada na escola, retorna erro de validação.

## Boas práticas ao operar o fluxo
- Sempre iniciar o wizard autenticado para garantir `escolaId` válido.
- Não pular a etapa de validação: ela popula `staging_alunos`, limpa tentativas anteriores e salva o mapeamento.
- Após importar, consulte erros detalhados para corrigir linhas com problemas e reprocessar se necessário (o fluxo é idempotente por `importId`).
- Ao matricular, reusar `numero_matricula` sugerido ou já presente do aluno evita duplicidade e mantém o login alinhado ao cadastro.
- Dropdown de “Turma Final” vazio: ajustamos o front para enviar o ano letivo derivado da sessão e a rota `/api/secretaria/turmas-simples` agora aceita `ano/ano_letivo` (derivado de `session_id`) e filtra pela view com esses parâmetros; turmas voltam a aparecer conforme o ano selecionado.
