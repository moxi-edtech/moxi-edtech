# Moxi Nexa — Guia Rápido (Angola)

Este repositório contém o módulo acadêmico/secretaria do Moxi Nexa, preparado para operação em escolas de Angola com foco em importação em massa, backfill automático da estrutura acadêmica, matrícula por turma (RPC) e rematrícula em massa. Para detalhes aprofundados do fluxo de importação e matrícula, consulte também `README-IMP.md`.

Principais URLs (App Router)
- Wizard de Importação: `/migracao/alunos`
- Deep link: `/migracao/alunos?importId={uuid}&step=review` reabre diretamente na Revisão de Matrícula do import.
- Rematrícula em Massa (Secretaria): `/secretaria/rematricula`
- Nova Matrícula (individual): `/secretaria/matriculas/nova`

Variáveis de ambiente (Web/API)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (obrigatória para rotas RPC server-side)

Fluxo recomendado (produção)
1) Backfill Acadêmico (opcional, via Wizard)
   - Analisar e criar Sessões (anos letivos), Classes, Cursos e Turmas em falta a partir do CSV (staging).
2) Importação de Pessoas
   - Importa somente “alunos” (dados civis). Se códigos de curso ou turma no CSV não existirem, o sistema os cria automaticamente: cursos como 'pendente' (aguardando aprovação do admin) e turmas como 'rascunho' (aguardando configuração).
3) Configuração de Estrutura Pós-Importação (NOVO)
   - Se cursos pendentes ou turmas rascunho foram criados, esta etapa do wizard permite ao secretário configurá-los (vincular a classes, nomear turmas) e ao admin aprová-los, antes de prosseguir.
4) Revisão de Matrícula (por Turma)
   - Após a configuração, pré-visualiza os grupos por turma (status “ready” ou “warning”).
   - O operador marca os lotes e confirma a matrícula.
5) Matrícula em Massa (RPC por Turma)
   - O front dispara em loop para cada turma marcada: `POST /api/matriculas/massa/por-turma`.
6) Rematrícula em Massa (Secretaria)
   - Suporta RPC e geração opcional de mensalidades.
7) Contexto Financeiro em Migração/Aprovação (NOVO)
   - Wizard de importação captura “ignorar matrícula” e “mês inicial da mensalidade” e aplica isenção automática de matrículas e mensalidades retroativas ao importar em turmas ativas.
   - Turma rascunho com alunos exibe bloco financeiro no TurmaForm; ao aprovar, aplica as mesmas regras para evitar cobranças indevidas.
   - Notificações direcionadas: rascunhos → admin/pedagógico; ativações/importações em turmas ativas → financeiro.

Getting Started (Angola)
- Migrations: rode as migrations do Supabase (inclui RPCs e índices críticos).
- Envs: configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Importação: acesse `/migracao/alunos` e siga os passos (inclui Backfill e Revisão por Turma).
- Gestão diária: use `/secretaria/matriculas` e `/secretaria/rematricula` para matrícula e rematrícula.
- PDFs oficiais: `/api/secretaria/matriculas/{id}/declaracao` gera PDF com QR e assinatura.
- Persistência de progresso: o Wizard grava localmente o passo atual, `importId`, `escolaId`, mapeamento e a seleção dos lotes de matrícula; ao recarregar a página, retoma de onde parou.

Cadastro de Aluno (Identidade) x Matrícula (Vínculo)
- Cadastro (UI: `/secretaria/alunos/novo`)
  - Campos obrigatórios: primeiro nome, sobrenome, data de nascimento, género, BI; contacto: email, telefone; encarregado: nome + telefone obrigatório (login do responsável). NIF é copiado do BI se vazio.
  - Payload: envia `primeiro_nome`, `sobrenome`, `nome` (concat), `bi_numero`, `nif`, `responsavel_nome`, `responsavel_contato`, `encarregado_email` (opcional). Backend salva o nome concatenado em `nome` e mantém aluno com status pendente.
- Matrícula (UI: `/secretaria/matriculas/nova`)
  - Seleciona aluno existente, sessão/ano letivo (deriva `ano_letivo` inteiro), modo Classe ou Curso Técnico, e a Turma (chave mestre). Curso/Classe servem para filtro/UX; validação final é pelo `turma_id`.
  - Payload: `aluno_id`, `turma_id`, `session_id`, `ano_letivo` (derivado), `curso_id`/`classe_id` conforme a turma. Backend gera `numero_matricula` e cria lançamentos financeiros (taxa de matrícula/mensalidades) via tabela de preço.
  - Validação: impede matrícula duplicada por `(escola_id, aluno_id, ano_letivo)` e só aceita turmas da escola/sessão informada.

APIs principais
- Backfill Acadêmico (preview/aplicar): `GET/POST /api/migracao/:importId/academico/backfill`
- Resumo da Importação (para configuração): `GET /api/migracao/:importId/summary`
- Salvar Configuração da Importação: `PATCH /api/migracao/:importId/configure`
- Preview de Matrícula: `GET /api/migracao/:importId/matricula/preview`
- Matrícula por Turma (RPC): `POST /api/matriculas/massa/por-turma`

Banco de Dados (pontos críticos)
- `importar_alunos` (RPC): apenas cria/atualiza em `public.alunos` (matching por profile_id → BI → email).
- `matricular_em_massa_por_turma` (RPC): matricula apenas a turma alvo (idempotente; ON CONFLICT reativa matrícula).
- Índice único em `mensalidades (escola_id, aluno_id, ano_referencia, mes_referencia)` para evitar duplicidade.

Documentação detalhada
- Leia `README-IMP.md` para o fluxo completo com diagramas Mermaid, endpoints e exemplos.

---

## Gestão e Funcionalidades Chave

### Aprovação de Turmas Pendentes

Durante a importação de alunos, turmas que não existem no sistema são criadas automaticamente com o status "rascunho". Para que essas turmas possam ser utilizadas, um administrador da escola precisa aprová-las.

-   **Visualização Detalhada**: A view `vw_turmas_para_matricula` foi atualizada para incluir a coluna `status_validacao`, permitindo que o frontend filtre e exiba corretamente as turmas pendentes e aprovadas.
-   **Correção de Rota API**: O endpoint `/api/escolas/[id]/turmas` foi ajustado para resolver um erro de acesso aos parâmetros da rota (`context.params`), garantindo o carregamento correto das informações da turma.
-   **Localização**: Portal do Administrador → Gestão de Turmas → Aba "Pendentes".
-   **Funcionalidade**: A aba "Pendentes" lista todas as turmas em estado de "rascunho".
-   **Aprovação em Lote**: Administradores podem selecionar múltiplas turmas através de checkboxes e aprová-las de uma só vez clicando no botão "Aprovar Selecionadas".
-   **Aprovação Individual**: Alternativamente, cada turma pode ser revisada e aprovada individualmente clicando no botão "Revisar".
-   **Componentes Técnicos**: A funcionalidade é suportada pelas funções RPC `get_pending_turmas` (para buscar) e `aprovar_turmas` (para aprovar).

### Correções e Melhorias

-   **Controle de Acesso**: O guarda de rota `RequireSecretaria` foi atualizado para permitir que usuários com o papel de `admin` também possam acessar as páginas da secretaria. Isso corrige um problema onde um administrador era redirecionado para a página de login ao tentar navegar de uma página de administração para uma página de secretaria.
-   **Autopreenchimento e criação "lazy" de Turmas**: O `TurmaForm` agora reconhece códigos de curso criados pelo onboarding (via `curriculum_key`/`presetKey`) e preenche curso/classe/turno/letra automaticamente em rascunhos e novas turmas. Ao salvar, o backend cria curso/classe sob demanda se ainda não existirem, usando o preset como fonte (ex.: `TG-10` cria Técnico de Gestão + 10ª Classe se faltarem). Para planilhas que não trazem turno, o auto-fill ignora placeholders ("N/D") e infere M/T/N direto do código (inclusive se o código vier apenas no `nome`, como "TI-10-M-A (Imp. Auto)").
-   **Rascunhos vindos da importação**: Turmas sem `status_validacao` agora são tratadas como rascunho no `TurmaForm`, disparando automaticamente o preenchimento sugerido (detetive) e mantendo o fluxo de aprovação/ativação sem bloquear o usuário.
-   **Listagens com fallback consistente**: As APIs `/api/secretaria/turmas` e `/api/escolas/[id]/turmas` devolvem `status_validacao` com fallback para `rascunho` e enriquecem com `turma_codigo`, garantindo que turmas importadas apareçam como rascunho e acionem as sugestões automáticas ao abrir.
-   **Formulário limpo ao reabrir**: Ao editar ou criar novas turmas, o `TurmaForm` reseta todos os campos a cada troca de turma carregada, evitando resíduos de estado entre revisões.
-   **Ações de Turma (server)**: O `saveAndValidateTurma` garante `await createClient()` antes de chamar `.from(...)`, eliminando erros de tipagem e garantindo execução correta no Supabase.

### Filtragem Determinística de Currículo para Cursos Ativos

Para garantir consistência e previsibilidade na estrutura acadêmica, a exibição dos detalhes de um curso ativo (currículo, turmas, alunos) é governada por um mecanismo de filtragem determinístico.

**Princípio Central:** O `CurriculumKey` é a única fonte da verdade.

-   **Fonte do `CurriculumKey`**: A `CurriculumKey` para qualquer curso é derivada exclusivamente de sua propriedade `codigo` (ex: `curso.codigo`). Esta chave deve corresponder a uma entrada válida no objeto `CURRICULUM_PRESETS` (`/src/lib/academico/curriculum-presets.ts`).
-   **Derivação Estrita**: A aplicação não tentará inferir a `CurriculumKey` a partir do nome do curso (`nome`) ou de qualquer outra propriedade. Se `curso.codigo` não for uma `CurriculumKey` válida, a visualização detalhada será desativada para esse curso, e um aviso será registrado.

**Fluxo de Dados:**

1.  **Currículo (Disciplinas)**: A lista de disciplinas e suas respectivas classes são extraídas diretamente dos `CURRICULUM_PRESETS` usando a `CurriculumKey`. Não há chamadas de API envolvidas para buscar disciplinas para um curso orientado por preset.
2.  **Classes**: As classes reais oferecidas pela escola são buscadas no banco de dados, mas são então filtradas para mostrar apenas aquelas que fazem parte do currículo definido pelo preset.
3.  **Turmas**: As turmas são filtradas com base no `curso_id` do curso selecionado.
4.  **Alunos**: A lista de alunos é derivada das turmas filtradas. A aplicação obtém todas as matrículas para as turmas filtradas e, em seguida, extrai as informações dos alunos.

Isso garante que o que é exibido no componente `StructureMarketplace` seja sempre uma representação fiel do preset de currículo selecionado.

---

## Documentação do Projeto

- **Design Tokens**: Consulte as diretrizes de design visual e tokens CSS em [`docs/design-tokens.md`](./docs/design-tokens.md).
- **Iconografia Oficial**: Veja o mapeamento oficial de ícones em [`docs/icon-map.md`](./docs/icon-map.md).

---

# Supabase CLI (v1)

[![Coverage Status](https://coveralls.io/repos/github/supabase/cli/badge.svg?branch=main)](https://coveralls.io/github/supabase/cli?branch=main)

[Supabase](https://supabase.io) is an open source Firebase alternative. We're building the features of Firebase using enterprise-grade open source tools.

This repository contains all the functionality for Supabase CLI.

- [x] Running Supabase locally
- [x] Managing database migrations
- [x] Creating and deploying Supabase Functions
- [x] Generating types directly from your database schema
- [x] Making authenticated HTTP requests to [Management API](https://supabase.com/docs/reference/api/introduction)

## Getting started

### Install the CLI

Available via [NPM](https://www.npmjs.com) as dev dependency. To install:

```bash
npm i supabase --save-dev
```

To install the beta release channel:

```bash
npm i supabase@beta --save-dev
```

> **Note**
For Bun versions below v1.0.17, you must add `supabase` as a [trusted dependency](https://bun.sh/guides/install/trusted) before running `bun add -D supabase`.

<details>
  <summary><b>macOS</b></summary>

  Available via [Homebrew](https://brew.sh). To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To install the beta release channel:
  
  ```sh
  brew install supabase/tap/supabase-beta
  brew link --overwrite supabase-beta
  ```
  
  To upgrade:

  ```sh
  brew upgrade supabase
  ```
</details>

<details>
  <summary><b>Windows</b></summary>

  Available via [Scoop](https://scoop.sh). To install:

  ```powershell
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```

  To upgrade:

  ```powershell
  scoop update supabase
  ```
</details>

<details>
  <summary><b>Linux</b></summary>

  Available via [Homebrew](https://brew.sh) and Linux packages.

  #### via Homebrew

  To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To upgrade:

  ```sh
  brew upgrade supabase
  ```

  #### via Linux packages

  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

  ```sh
  sudo apk add --allow-untrusted <...>.apk
  ```

  ```sh
  sudo dpkg -i <...>.deb
  ```

  ```sh
  sudo rpm -i <...>.rpm
  ```

  ```sh
  sudo pacman -U <...>.pkg.tar.zst
  ```
</details>

<details>
  <summary><b>Other Platforms</b></summary>

  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

  ```sh
  go install github.com/supabase/cli@latest
  ```

  Add a symlink to the binary in `$PATH` for easier access:

  ```sh
  ln -s "$(go env GOPATH)/cli" /usr/bin/supabase
  ```

  This works on other non-standard Linux distros.
</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
  To install in your working directory:

  ```bash
  pkgx install supabase
  ```

  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).
</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
