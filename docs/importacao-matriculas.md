# Fluxo de importação de alunos e matrícula em massa (v2.0)

Este guia descreve o fluxo ponta a ponta de importação de alunos via wizard, validação em staging, disparo da função de importação, acompanhamento de histórico/erros e o **novo fluxo de aprovação e ativação de matrículas**.

## Visão geral do novo fluxo
1.  **Upload autenticado**: O wizard obtém `escolaId` e `userId` da sessão Supabase e envia o CSV para `/api/migracao/upload`, que salva no bucket `migracoes` e cria um registro em `import_migrations` com `importId` real.
2.  **Mapeamento + validação**: O usuário mapeia colunas no passo 2 e seleciona o "Ano Letivo de Importação". `/api/migracao/alunos/validar` lê o arquivo, converte linhas para `staging_alunos` (incluindo o `ano_letivo` selecionado), limpa erros anteriores e salva `column_map`/`total_rows` na mesma `import_migrations`.
3.  **Importação (`importar_alunos_v4`)**: Disparada por `/api/migracao/alunos/importar` com os novos parâmetros `modo` e `data_inicio_financeiro`. Esta função:
    *   Deduplica alunos (por `BI_NUMERO` ou `NOME_COMPLETO` + `DATA_NASCIMENTO`).
    *   Cria `alunos` e `turmas` (se necessário) em estado de `rascunho` ou `'pendente'`, e `matriculas` como `'pendente'`.
    *   Grava `numero_processo_legado` para busca histórica.
    *   Retorna um resumo detalhado (`imported`, `turmas_created`, `matriculas_pendentes`, `errors`).
4.  **Configuração e Aprovação**: Administradores revisam e aprovam os cursos/turmas criados como `rascunho` na página de gestão de turmas. A aprovação da turma ativa automaticamente o curso e as matrículas pendentes.
5.  **Acompanhamento**: A tela de finalização busca `/api/migracao/[importId]/erros` para listar erros linha a linha e a página de histórico consome `/api/migracao/historico` para exibir as últimas importações.

## Funil de Admissão (cadastro → candidatura → matrícula)
-   O processo de importação agora atende a dois modos principais: `onboarding` (para novos candidatos) e `migracao` (para alunos existentes com matrícula direta).
-   A conversão para matrícula (para candidatos do modo `onboarding`) continua ocorrendo via endpoint dedicado `/api/secretaria/candidaturas/[id]/confirmar`, que insere em `matriculas` e marca a candidatura como `matriculado`.

## Wizard de migração (frontend)
-   **Contexto autenticado**: O wizard carrega `userId` e resolve `escolaId`. O upload é bloqueado sem escola válida.
-   **Upload (passo 1)**: Envia o arquivo para `/api/migracao/upload`; guarda `importId` e extrai cabeçalhos do CSV.
-   **Mapeamento + validação (passo 2)**: Envia `importId`, `escolaId`, `columnMap` e **`anoLetivo`** para `/api/migracao/alunos/validar`. O `anoLetivo` é persistido na `staging_alunos`.
-   **Pré-visualização (passo 3)**: Exibe amostra dos dados validados.
-   **Estrutura Acadêmica (passo 4)**: Processo de backfill para garantir que a estrutura acadêmica base está pronta.
-   **Importação (passo 5)**: Dispara `/api/migracao/alunos/importar` com `importId`, `escolaId`, `modo` e `data_inicio_financeiro`.
    *   **`modo: 'migracao'`**: Cria alunos e matrículas `pendentes`.
    *   **`modo: 'onboarding'`**: Apenas cria alunos com status `pendente`.
-   **Configuração (passo 6)**: Administradores podem visualizar e aprovar cursos e turmas em rascunho criados pela importação.
-   **Finalização (passo 7)**: Exibe resumo e erros.

## APIs do fluxo de importação
-   **Upload** (`POST /api/migracao/upload`)
    -   Campos obrigatórios: `file` (CSV), `escolaId`; opcional `userId`.
    -   Salva o arquivo e insere em `import_migrations` com status `uploaded`; devolve `importId`.

-   **Validação** (`POST /api/migracao/alunos/validar`)
    -   Corpo: `{ importId, escolaId, columnMap, anoLetivo }`.
    -   Converte o CSV para `staging_alunos` (persistindo `anoLetivo` por linha), limpa erros anteriores, faz `upsert` do staging, atualiza `import_migrations` para `validado`.

-   **Importação** (`POST /api/migracao/alunos/importar`)
    -   Corpo: `{ importId, escolaId, modo, dataInicioFinanceiro }`.
    -   **Chama a RPC `importar_alunos_v4`** para processar o staging.

-   **Erros de importação** (`GET /api/migracao/[importId]/erros`)
    -   Retorna erros de `import_errors`.

-   **Histórico** (`GET /api/migracao/historico`)
    -   Lista registros de `import_migrations`.

-   **Aprovação de Turmas** (`POST /api/escolas/[id]/admin/turmas/aprovar`)
    -   Corpo: `{ turma_ids: string[] }`.
    -   **Chama a RPC `aprovar_turmas`** que, para cada turma:
        *   Inferere o curso do `turma_codigo`.
        *   Cria/aprova o curso (se não existir, ou se estiver `rascunho`).
        *   Aprova a turma (`status_validacao = 'aprovado'`) e vincula ao `curso_id`.
        *   Ativa todas as matrículas pendentes vinculadas a essa turma.

-   **Geração de Mensalidades** (`POST /api/financeiro/mensalidades/gerar`)
    -   Corpo: `{ ano_letivo, mes_referencia, dia_vencimento }`.
    -   **Chama a RPC `gerar_mensalidades_lote`** que gera as cobranças para o mês/ano especificados, respeitando o "Escudo Financeiro".

## Formato do Código da Turma
-   **Estrutura Obrigatória:** `CURSO-CLASSE-TURNO-LETRA` (ex.: `TI-10-M-A`).
-   **CURSO**: Sigla configurada pela escola (ex: `EP`, `TI`). Usado para inferir o `curso`.
-   **CLASSE**: Número 1–13. **TURNO**: `M` (manhã), `T` (tarde), `N` (noite). **LETRA**: Letra(s) (ex: `A`, `B`).

## Fluxo de Aprovação e Ativação
Este é o "gate" de controle administrativo:

1.  **Importação (`importar_alunos_v4`)**:
    *   Cria `turmas` com `status_validacao = 'rascunho'`.
    *   Cria `matriculas` com `status = 'pendente'`, `ativo = false`, e `numero_matricula = NULL`.

2.  **Aprovação na Gestão de Turmas (`aprovar_turmas` via `/admin/turmas/aprovar`)**:
    *   O administrador revisa e seleciona as turmas em rascunho.
    *   Ao aprovar uma turma, a RPC `aprovar_turmas` é acionada:
        *   Ela **cria ou aprova o curso** inferido do `turma_codigo`.
        *   Ela atualiza a `turma` para `status_validacao = 'aprovado'` e vincula o `curso_id` correto.
        *   Ela **ativa todas as matrículas pendentes** associadas a essa turma (status `'ativa'`, `ativo=true`, gera `numero_matricula`).

3.  **Controle Financeiro ("Escudo Financeiro")**:
    *   A `data_inicio_financeiro` (definida na importação) é gravada na matrícula.
    *   A função `gerar_mensalidades_lote` (chamada via `/financeiro/mensalidades/gerar`) só gerará mensalidades para um aluno se a data de vencimento da mensalidade for **igual ou posterior** à sua `data_inicio_financeiro`.

## Boas práticas ao operar o fluxo
-   **Validação rigorosa do CSV**: Use a estrutura `CURSO-CLASSE-TURNO-LETRA` para `turma_codigo`.
-   **Modo de Importação**: Escolha `migracao` para alunos existentes e `onboarding` para novos candidatos.
-   **Data de Início Financeiro**: Defina-a com cuidado para evitar cobranças indevidas.
-   **Não pular a validação**: Ela popula a `staging_alunos` com dados essenciais, como o `anoLetivo` por linha.
-   **Acompanhamento Pós-Importação**:
    *   Consulte erros detalhados.
    *   Vá à tela de "Gestão de Turmas" (`/escolas/[id]/admin/turmas`) para **aprovar os rascunhos de turmas**. Este é um passo crucial para ativar as matrículas e permitir o fluxo financeiro.
-   **Geração de Cobranças**: Após a aprovação das turmas, use o botão "Gerar Cobranças em Lote" no Dashboard Financeiro para iniciar o ciclo de cobrança.