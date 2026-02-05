# Roadmap — Implementação com Dados Reais (Admin Setup)

## Objetivo
Evoluir os wireframes da "Dona Maria" para operações reais (SSOT), conectando UI → API → RPC/DB com validações P0 e idempotência.

## O que já foi entregue
- Dashboard conceitual e navegação de configuração (`SettingsHub`, `StructureMarketplace`).
- Páginas conceituais do setup admin (`/admin/configuracoes/*`).
- RPCs SSOT (`get_setup_state`, `get_config_impact`, `preview_apply_changes`, `config_commit`) com base.
- Modelo de avaliação e disciplina com schema/RPCs e bloqueio de currículo publicado.
- Idempotência em gerar turmas (`Idempotency-Key` + audit).
- Conexões iniciais com dados reais nas páginas conceituais (setup, calendário, avaliação, turmas, fluxos e sandbox).
- Novas rotas API para setup real: `setup/state`, `setup/impact`, `setup/preview`, `periodos-letivos`, `audit/recent`.

## Plano de Implementação (Dados Reais)

### Fase 1 — Dashboard e Barra de Impacto
**Meta:** sair do placeholder e usar `get_setup_state` + `get_config_impact`.
- [x] Chamar `get_setup_state` na página `sistema` e mostrar blockers.
- [x] Integrar `SettingsHub` ao `get_setup_state` com badges reais.
- [x] Barra de status usa `get_config_impact`.
- [x] CTA “Próximo passo” usa `next_action` do RPC.

### Fase 2 — Calendário (Períodos Letivos)
**Meta:** leitura/escrita real em `periodos_letivos`.
- [x] Listar períodos reais com `peso` e `trava_notas_em`.
- [x] Validar overlap/pesos = 100 (via `get_setup_state`).
- [x] Persistir via `/admin/periodos-letivos/upsert-bulk`.

### Fase 3 — Avaliação (Modelos)
**Meta:** usar `modelos_avaliacao` real.
- [x] Listar modelos reais e fórmula padrão na página de avaliação.
- [x] CRUD completo dos modelos com UI visual (sem JSON).
- [x] Preview de pauta (simulado) com dados reais do modelo.
- [x] Vincular disciplina ao `modelo_avaliacao_id`.

### Fase 4 — Currículo e Turmas
**Meta:** garantir currículo publicado + geração de turmas atômica.
- [x] Impacto real de turmas via `get_config_impact`.
- [x] Exibir status de currículo (draft/published) por curso.
- [x] Botão “Publicar currículo” usando `curriculo_publish`.
- [x] Gerar turmas via `gerar_turmas_from_curriculo` (idempotente).

### Fase 5 — Fluxos e Sandbox
**Meta:** sandbox real usando `preview_apply_changes`.
- [x] Testar configurações sem tocar dados reais (`preview_apply_changes`).
- [x] Audit status real em Fluxos (`audit_logs`).
- [x] Simular relatório (conflitos/impacto) completo.
- [x] Export/Apply com `config_commit`.

### Fase 6 — Currículo Granular e Publicação Segura (Novo Contrato)
**Meta:** Implementar um fluxo de edição e publicação de currículos que seja ao mesmo tempo robusto e flexível, tratando o currículo publicado como um "contrato" completo e imutável.

**Regra de Ouro (KLASSE):** _Currículo publicado = disciplinas + metadados acadêmicos obrigatórios. Se não tem isso, não publica._

**Arquitetura Proposta:**
1.  **Enriquecer Vínculo `curso_matriz`:** A tabela `curso_matriz` (ou uma nova `curriculo_itens`) se tornará a fonte da verdade para os metadados de uma disciplina *dentro de um currículo específico*. Ela deve conter:
    *   `carga_horaria_semanal`
    *   `classificacao` (`core`, `complementar`, `optativa`)
    *   `periodos_ativos` (array de números, ex: `[1, 2, 3]`)
    *   `entra_no_horario` (booleano)
    *   `avaliacao_mode` e `avaliacao_base_id`
    *   `status_completude` (`completo` ou `incompleto`)

2.  **Ajustar `DisciplinaModal`:** O modal passa a editar o registro de `curso_matriz`, preenchendo os metadados acima. Ele não altera mais o `disciplinas_catalogo` global.

3.  **Blindar o RPC `curriculo_publish`:**
    *   Antes de publicar, o RPC deve validar se **todas** as disciplinas no currículo (todos os itens de `curso_matriz` associados) possuem `status_completude = 'completo'`.
    *   Caso contrário, a publicação deve falhar e retornar uma lista estruturada das pendências para a UI.

4.  **Melhorar a UX:**
    *   A interface de gestão de currículo deve mostrar o status de completude (ex: "Rascunho - 4 pendências").
    *   Um botão "Resolver pendências" deve guiar o usuário.
    *   Cada disciplina na lista deve ter um badge (`✅ Completa` ou `⚠️ Pendente`), e o clique deve abrir o modal para preenchimento.
    *   O botão "Publicar Currículo" só fica habilitado quando 100% das disciplinas estiverem completas.

5.  **Ajustar Geração de Turmas:** O RPC `gerar_turmas_from_curriculo` deve copiar os metadados enriquecidos (carga horária, etc.) do `curso_matriz` para a tabela `turma_disciplinas` no momento da criação das turmas.

## Pendências / Backlog
- **RLS + Endpoints:** revisar rotas ainda usando `service_role`.
- **Padrão Idempotency-Key:** aplicar em todas ações críticas.
- **Controle de permissões por role:** alinhar com regras de admin/secretaria.
- **Paginação global:** listas grandes de disciplinas/turmas/alunos.
- **Auditoria:** garantir `audit_logs` com `escola_id` em toda ação crítica.

---

## Sessão Atual — Modal de Disciplina + Dashboard Principal (Design System)

### Escopo
- Padronizar o modal de Disciplina com o contrato real (`periodos_ativos`, `avaliacao`, `classificacao`, etc.) e aplicar o layout “Cartões de Decisão”.
- Garantir identidade visual KLASSE no dashboard principal (Slate-950, dourado e verde brand).

### Implementação
- **Disciplina Modal (Design System + Contrato Real):**
  - Arquivo final: `apps/web/src/components/escola/settings/_components/DisciplinaModal.tsx`.
  - Layout com header em verde KLASSE (`#1F6B3B`), corpo em `slate-50` e rodapé com impacto/ações.
  - Mantém contrato completo: `periodos_ativos`, `periodo_mode`, `carga_horaria_semanal`, `classificacao`, `entra_no_horario`, `avaliacao { mode, base_id }`.
  - Validações: nome/código únicos, períodos obrigatórios no modo custom, carga > 0, disciplina base quando herda avaliação.
  - UX: toggle de períodos com proteção para não zerar seleção, cálculo de impacto (`totalHorasAno`).

- **Dashboard Principal (Design System KLASSE):**
  - Página alvo: `apps/web/src/app/escola/[id]/admin/configuracoes/sistema/page.tsx`.
  - Ajustes visuais: CTA em `slate-900`, progresso em dourado (`#E3B23C`), cards concluídos em verde brand (`#1F6B3B`).
  - Mantém integração real com `setup/state` e `setup/impact` via `fetch` com `cache: "no-store"`.

### Observações de Contrato
- O modal preserva o contrato de dados já definido para o backend (sem quebra de schema).
- Nenhuma mudança de schema/SQL foi aplicada nesta sessão.

### Próximos passos (quando ligar backend)
- Criar endpoints reais para `POST/PATCH/DELETE` de disciplinas com:
  - `escola_id` obrigatório e validação de tenant.
  - `codigo` único por curso.
  - `audit_log` obrigatório (P0).

### Verificação BD Remota (read-only)
- Tabelas de persistência confirmadas: `disciplinas_catalogo`, `curso_matriz`.
- `disciplinas_catalogo` colunas principais:
  - `id`, `escola_id`, `nome`, `sigla`, `carga_horaria_semana`, `is_core`, `is_avaliavel`, `area`, `aplica_modelo_avaliacao_id`, `herda_de_disciplina_id`.
- `curso_matriz` colunas principais:
  - `id`, `escola_id`, `curso_id`, `classe_id`, `disciplina_id`, `carga_horaria`, `obrigatoria`, `ordem`, `curso_curriculo_id`.
- Contagens atuais:
  - `disciplinas_catalogo`: 78 registros.
  - `curso_matriz`: 201 registros.

---

## Sessão Atual — Currículo Completo (Drafts, Pendências e Publish Seguro)

### Objetivo
Implementar o contrato “currículo publicado = metadados completos”, permitir onboarding com currículo incompleto (lazy), e exibir pendências no admin dashboard/portal com atalho direto para o modal.

### Mudanças de Schema / RPC (Aplicadas no remoto)
- **Migração:** `supabase/migrations/20260307000000_curriculo_profile_fields.sql`
  - Novos campos em `curso_matriz`: `carga_horaria_semanal`, `classificacao`, `periodos_ativos`, `entra_no_horario`, `avaliacao_mode`, `avaliacao_modelo_id`, `avaliacao_disciplina_id`, `status_completude`.
  - Novos campos em `turma_disciplinas` para copiar metadados do currículo publicado.
  - `curriculo_publish` reforçado: valida pendências e retorna lista estruturada (`pendencias`, `pendencias_count`).
  - `curriculo_rebuild_turma_disciplinas` e `gerar_turmas_from_curriculo` agora copiam metadados.
- **Policies:** `supabase/migrations/20260307000001_curriculo_delete_policies.sql`
  - DELETE em `curso_matriz` e `turma_disciplinas` **apenas** para `admin_escola` e `admin`.

### API / Backend
- `POST /api/escola/:id/admin/curriculo/install-preset` agora cria currículo **sem auto publish**.
- `POST /api/escola/:id/admin/curriculo/publish` retorna pendências quando incompleto.
- `GET /api/escolas/:id/disciplinas` suporta filtro `status_completude` e embed explícito `disciplinas_catalogo!curso_matriz_disciplina_id_fkey`.
- `PUT /api/escolas/:id/disciplinas/:disciplinaId` cria **draft v2** automaticamente se a disciplina estiver em currículo published e edita o rascunho.

### UI / UX
- **Onboarding (AcademicStep2):** permite concluir mesmo sem turmas (lazy), aviso para ajustar depois.
- **StructureMarketplace:**
  - Lista com badges de pendência.
  - Botão “Resolver pendências” abre modal com filtro direto.
  - Suporte a `?resolvePendencias=1` para abrir modal automaticamente.
- **Admin Dashboard:** badge de pendências no currículo com link direto para abrir modal.

### Fixes Operacionais
- Corrigido embed ambíguo de `disciplinas_catalogo` na API (PGRST201).
- Ajustada lógica de delete de curso para remover `curso_matriz` antes de apagar `curso_curriculos`.

### Arquivos-chave
- `apps/web/src/lib/academico/curriculum-apply.ts`
- `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts`
- `apps/web/src/app/api/escolas/[id]/disciplinas/[disciplinaId]/route.ts`
- `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`
- `apps/web/src/components/escola/settings/StructureMarketplace.tsx`
- `apps/web/src/components/escola/settings/_components/DisciplinaModal.tsx`
- `apps/web/src/components/escola/settings/CourseManager.tsx`
- `apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx`

### Observações
- Publicação agora exige `status_completude = completo` para todos os itens do currículo.
- Disciplinas publicadas não são alteradas; editar cria automaticamente um draft.
- Pendências são visíveis no dashboard e no currículo, com atalho direto ao modal.

---

## Sessão Atual — Secretaria (Pautas com Períodos Ativos)

### Objetivo
Integrar metadados do currículo às telas da secretaria, garantindo que pautas e gestão de notas respeitem `periodos_ativos`.

### Implementação
- **API Secretaria:** `GET /api/secretaria/turmas/:id/disciplinas`
  - Retorna `meta` do `turma_disciplinas` (carga horária, periodos, classificacao, avaliacao_mode).
  - Retorna `periodos_letivos` do ano da turma para seleção rápida.
- **Pauta rápida:** `PautaRapidaModal`
  - Adicionado seletor de período.
  - Lista de disciplinas filtrada por `periodos_ativos`.
  - Seleção inválida é resetada automaticamente.
- **Detalhe da turma:** `TurmaDetailClient`
  - Disciplina listadas filtradas por período selecionado.
  - Merge de `periodos_ativos` para dados vindos da view `turma_disciplinas_professores`.

### Arquivos-chave
- `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts`
- `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts`
- `apps/web/src/components/secretaria/PautaRapidaModal.tsx`
- `apps/web/src/components/secretaria/TurmaDetailClient.tsx`

---

## Sessão Atual — POS/Balcão (Pagamento rápido)

### Objetivo
Ativar o fluxo de pagamento imediato no balcão da secretaria.

### Implementação
- **Endpoint novo:** `POST /api/financeiro/pagamentos/registrar`
  - Valida autenticação + role (`secretaria`, `financeiro`, `admin`, `admin_escola`, `staff_admin`).
  - Resolve tenant via `mensalidades.escola_id`.
  - Chama RPC `registrar_pagamento`.
  - Registra em `pagamentos` caso não exista pagamento concluído.
  - Normaliza métodos (`numerario` → `dinheiro`, `multicaixa` → `tpa_fisico`, `mbway` → `referencia`).

### Arquivo-chave
- `apps/web/src/app/api/financeiro/pagamentos/registrar/route.ts`
