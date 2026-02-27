# Status Report – Módulo Académico (KLASSE)

Data da auditoria: 2026-02-25  
Escopo validado: Next.js App Router + TypeScript (`apps/web/src/**`) e Supabase SQL (`supabase/migrations/**`)

---

## 1. CATÁLOGO DE DISCIPLINAS (SSOT vs Customização)

### 1.1. Schema de Disciplinas
- **Status: 🟢 Implementado**
- **Evidências:**
  - Existe catálogo por escola em `disciplinas_catalogo` (`escola_id`, `nome`, `sigla`) sem coluna explícita de escopo global/preset nessa tabela.  
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql` (CREATE TABLE `disciplinas_catalogo`).
  - Existe modelo novo separado para preset/global + customização:
    - `curriculum_presets` (catálogo base global)
    - `curriculum_preset_subjects` (disciplinas por preset)
    - `school_subjects` (override por escola)
    Arquivo: `supabase/migrations/20261127000000_curriculum_presets_tables.sql`.
  - O fluxo de aplicação curricular agora usa presets em DB como fonte primária.
    - `apps/web/src/lib/academico/curriculum-apply.ts` (loadPresetSubjects)
    - `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts` (buildDefaultConfig DB)
- **Comentários:**
  - O SSOT foi consolidado no modelo `curriculum_preset_subjects` + `school_subjects`.

### 1.2. Distinção Preset Global vs Customização da Escola
- **Status: 🟢 Implementado**
- **Evidências:**
  - Distinção existe no novo modelo:
    - Global: `curriculum_preset_subjects`.
    - Custom escola: `school_subjects.escola_id`, `custom_weekly_hours`, `custom_name`.
    Arquivo: `supabase/migrations/20261127000000_curriculum_presets_tables.sql`.
  - API e fluxo core usam preset DB + overrides da escola.
    Arquivos:
    - `apps/web/src/app/api/escolas/[id]/curriculo/padroes/route.ts`
    - `apps/web/src/lib/academico/curriculum-apply.ts`
- **Comentários:**
  - A distinção está unificada e não depende mais do preset hardcoded.

### 1.3. Flag para média / reprovação (`conta_para_media_med` ou equivalente)
- **Status: 🟢 Implementado**
- **Evidências:**
  - Coluna `conta_para_media_med` adicionada em `curso_matriz`, `turma_disciplinas` e `school_subjects`.
    Arquivo: `supabase/migrations/20260225000001_academic_integrity_fixes.sql`.
  - Propagação para `turma_disciplinas` no RPC de geração por currículo.
    Arquivo: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`.
- **Comentários:**
  - Flag está integrada ao cálculo do boletim/pauta anual.

### 1.4. Metadados do catálogo no frontend (labels/descrições/classes)
- **Status: 🟡 Em evolução**
- **Evidências:**
  - UI de seleção e configuração de presets agora busca `name`/`description` diretamente de `curriculum_presets`.
    Arquivos:
    - `apps/web/src/hooks/usePresetSubjects.ts` (`usePresetsCatalog`)
    - `apps/web/src/components/escola/onboarding/CurriculumPresetSelector.tsx`
    - `apps/web/src/components/escola/settings/CurriculumBuilder.tsx`
  - Contagem de disciplinas/classes no UI vem de `curriculum_preset_subjects`.
    Arquivos:
    - `apps/web/src/hooks/usePresetSubjects.ts` (`usePresetsMeta`)
    - `apps/web/src/components/escola/settings/StructureMarketplace.tsx`
  - Aplicação de currículo prioriza nome do preset vindo do DB quando disponível.
    Arquivo: `apps/web/src/lib/academico/curriculum-apply.ts`
  - Metadados operacionais (`course_code`, `badge`, intervalo de classes) passam a viver em `curriculum_presets`.
    Arquivos:
    - `supabase/migrations/20260312000000_curriculum_presets_metadata.sql`
    - `supabase/migrations/20261127000001_curriculum_presets_seed.sql`
    - `apps/web/src/app/api/escolas/[id]/classes/route.ts`
  - RPC admin ajustada para persistir metadados do preset quando disponíveis.
    Arquivo: `supabase/migrations/20260320000005_curriculum_presets_admin_rpc.sql`
- **Comentários:**
  - Backend agora prioriza DB, mas mantém `CURRICULUM_PRESETS_META` como fallback de compatibilidade.

### 1.5. Pauta geral alinhada ao modelo oficial
- **Status: 🟡 Em evolução**
- **Evidências:**
  - `pauta-geral` passa a calcular MT com base nos pesos do modelo via `resolveModeloAvaliacao`.
    Arquivos:
    - `apps/web/src/lib/pedagogico/pauta-geral.ts`
    - `apps/web/src/lib/pedagogico/grade-engine.ts`
- **Comentários:**
  - `pauta-anual` agora usa regras do modelo para aprovação; o engine legado ainda é usado como fallback.

### 1.6. Regras de transição alinhadas ao modelo
- **Status: 🟡 Em evolução**
- **Evidências:**
  - `transition-engine` resolve regras a partir de `modelos_avaliacao.regras` quando disponível.
    Arquivo: `apps/web/src/lib/pedagogico/transition-engine.ts`
  - `pauta-anual` consome essas regras para o resultado final.
    Arquivo: `apps/web/src/lib/pedagogico/pauta-anual.ts`

### 1.7. Carga horária semanal (match resiliente)
- **Status: 🟡 Em evolução**
- **Evidências:**
  - `curso_matriz` agora resolve `carga_horaria_semanal` com fallback por nome normalizado (preset → catálogo).
    Arquivo: `apps/web/src/lib/academico/curriculum-apply.ts`

---

## 2. O EFEITO DOMINÓ (Pre-flight Check de Publicação)

### 2.1. Ações de “Publicar” ou “Ativar” Currículo/Curso
- **Status: 🟢 Implementado**
- **Evidências:**
  - Endpoint de publicação: `POST /api/escola/[id]/admin/curriculo/publish` chama `rpc curriculo_publish`.
    Arquivo: `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`.
  - Funções SQL envolvidas:
    - `curriculo_publish`
    - `curriculo_publish_single`
    - `curriculo_publish_legacy`
    Arquivos:
    - `supabase/migrations/20261201090000_curriculo_publish_auto_avaliacoes.sql`
    - `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`
    - `supabase/migrations/20261128040000_fix_curriculo_publish_legacy.sql`
- **Comentários:**
  - O backbone de publish está claro e centralizado no backend SQL (bom para consistência).

### 2.2. Validação transacional / pre-flight check
- **Status: 🟢 Implementado**
- **Evidências:**
  - Validações backend antes de publicar:
    - Bloqueio de currículo vazio (`curriculo sem disciplinas`)
    - Pendências de metadados obrigatórios
    - Overload de carga horária
    - Mínimo de disciplinas core
    Arquivo: `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`.
  - Pre-flight de completude do curso (classes esperadas x classes com versão publicada) com retorno de pendências.
    Arquivo: `supabase/migrations/20260320000000_curriculo_publish_preflight_audit.sql`.
  - O fluxo ocorre dentro da transação da função PL/pgSQL e usa `pg_advisory_xact_lock` (controle de concorrência).
    Arquivos:
    - `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`
    - `supabase/migrations/20261128040000_fix_curriculo_publish_legacy.sql`
- **Comentários:**
  - O publish agora falha explicitamente quando o curso não tem todas as classes cobertas.

### 2.3. Coluna de status (RASCUNHO vs PUBLICADO/ATIVO)
- **Status: 🟢 Implementado**
- **Evidências:**
  - `curso_curriculos.status` existe com enum `curriculo_status` e é usada no publish (`draft`, `published`, `archived`).
    Arquivos:
    - `supabase/migrations/20260127020139_remote_schema.sql`
    - `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`
  - `cursos.status_aprovacao` e `turmas.status_validacao` também existem.
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - Há uso em algumas consultas/fluxos (`curriculo.status` em disciplinas API; filtros de turmas).
    Arquivos:
    - `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts`
    - `apps/web/src/app/api/escolas/[id]/turmas/route.ts`
  - Gate explícito para criação manual de turma valida currículo publicado e disciplinas.
    Arquivos:
    - `apps/web/src/app/api/escolas/[id]/turmas/route.ts`
    - `apps/web/src/lib/academico/turma-gate.ts`.
- **Comentários:**
  - Status agora é aplicado de forma consistente nos endpoints críticos de escrita.

### 2.4. Nomenclatura de status (contrato único)
- **Status: 🟢 Implementado**
- **Evidências:**
  - `cursos.status_aprovacao` usa valores como `aprovado`.
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - `turmas.status_validacao` usa `ativo`, `rascunho`, `arquivado` (e é usado em filtros de listagem).
    Arquivos:
    - `supabase/migrations/20260127020139_remote_schema.sql`
    - `apps/web/src/types/turmas.ts`
  - `curso_curriculos.status` usa enum `curriculo_status` (`draft`, `published`, `archived`).
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - `turmas.status_fecho` usa `ABERTO/FECHADO` para bloqueio de notas.
    Arquivo: `supabase/migrations/20261128065000_add_turmas_status_fecho.sql`.
- **Comentários:**
  - RPC `get_estado_academico` fornece normalização (`active`, `draft`, `archived`, `open/closed`).

---

## 3. GERAÇÃO DE TURMAS E INTEGRIDADE

### 3.1. Fluxo de criação de turmas
- **Status: 🟢 Implementado**
- **Evidências:**
  - Fluxo API direto de criação: `POST /api/escolas/[id]/turmas` recebe `nome`, `turno`, `ano_letivo`, `curso_id`, `classe_id`, etc., e insere em `turmas`.
    Arquivo: `apps/web/src/app/api/escolas/[id]/turmas/route.ts`.
  - Fluxo RPC de geração por currículo: `gerar_turmas_from_curriculo` cria `turmas` e depois `turma_disciplinas` com base em `curso_matriz` publicado.
    Arquivos:
    - `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`
    - `supabase/migrations/20261201090000_curriculo_publish_auto_avaliacoes.sql`
  - Fluxo server action também existe para validação/aprovação operacional de turma.
    Arquivo: `apps/web/src/features/turmas/actions.ts`.
- **Comentários:**
  - Existem múltiplos caminhos de criação; isso dá flexibilidade, mas aumenta superfície de inconsistência.

### 3.2. Bloqueio quando Curso/Currículo está em rascunho
- **Status: 🟢 Implementado**
- **Evidências:**
  - O RPC `gerar_turmas_from_curriculo` exige currículo `status = 'published'`.
    Arquivo: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`.
  - Endpoint de criação manual de turma impõe bloqueio via gate de currículo publicado e disciplinas.
    Arquivos:
    - `apps/web/src/app/api/escolas/[id]/turmas/route.ts`
    - `apps/web/src/lib/academico/turma-gate.ts`.
  - Trigger no banco impede inserts diretos sem currículo publicado.
    Arquivo: `supabase/migrations/20260225000001_academic_integrity_fixes.sql`.
- **Comentários:**
  - Regra agora está aplicada em API e banco.

### 3.3. Ligação Turma → Disciplinas
- **Status: 🟢 Implementado**
- **Evidências:**
  - Tabela ponte `turma_disciplinas` existe e referencia `turma_id` + `curso_matriz_id` (normalizado), com chave única por `(escola_id, turma_id, curso_matriz_id)` via upsert no fluxo.
    Arquivos:
    - `supabase/migrations/20260127020139_remote_schema.sql` (table/FKs)
    - `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql` (insert/upsert)
  - Campo `professor_id` existe no payload de inserção da RPC (`NULL` inicial), permitindo atribuição posterior sem duplicar estrutura da disciplina.
    Arquivo: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`.
- **Comentários:**
  - Modelagem é majoritariamente limpa e relacional (ponto forte).

### 3.4. Fecho de turma e travas de período
- **Status: 🟢 Implementado**
- **Evidências:**
  - Triggers bloqueiam notas/avaliações quando `turmas.status_fecho != 'ABERTO'`.
    Arquivo: `supabase/migrations/20261128065000_add_turmas_status_fecho.sql`.
  - Triggers agora também respeitam `periodos_letivos.trava_notas_em`.
    Arquivo: `supabase/migrations/20260320000001_guard_periodo_fechado_notas.sql`.
  - RPC para fechar/reabrir turma com auditoria (`turma_set_status_fecho`).
    Arquivos:
    - `supabase/migrations/20260320000002_turma_fecho_status_rpc.sql`
    - `supabase/migrations/20260320000003_turma_fecho_admin_only.sql`.
  - Endpoint admin expõe o status e controle de fecho.
    Arquivo: `apps/web/src/app/api/escola/[id]/admin/turmas/[turmaId]/fecho/route.ts`.
- **Comentários:**
  - Fecho de turma agora é controlável por admin e respeita fecho de período.

---

## 4. PROTEÇÃO DOS DADOS (RLS e Integridade)

### 4.1. Políticas de RLS
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - RLS ativa para tabelas acadêmicas principais (`cursos`, `classes`, `curso_curriculos`, `curso_matriz`, `disciplinas_catalogo`, `turmas`, `turma_disciplinas`).
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - No modelo novo de presets:
    - `curriculum_presets` e `curriculum_preset_subjects`: somente leitura para `authenticated`.
    - `school_subjects`: read/write por `escola_id` do usuário.
    Arquivo: `supabase/migrations/20261127000000_curriculum_presets_tables.sql`.
  - **Risco mitigado:** escrita em presets globais é feita via RPCs admin-only (`curriculum_presets_*`), mantendo leitura pública e evitando DML direto.
- **Comentários:**
  - Multi-tenant está bem encaminhado, mas governança de catálogo global merece política explícita/documentada.

### 4.2. Proteção contra exclusão com dados dependentes
- **Status: 🟢 Implementado**
- **Evidências:**
  - Há proteção por FK em cadeias críticas:
    - `curso_matriz.disciplina_id -> disciplinas_catalogo(id) ON DELETE RESTRICT`
    - `turma_disciplinas.curso_matriz_id -> curso_matriz(id) ON DELETE RESTRICT`
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - API de DELETE de disciplina também bloqueia quando há vínculo em currículo publicado/ativo.
    Arquivo: `apps/web/src/app/api/escolas/[id]/disciplinas/[disciplinaId]/route.ts`.
  - FK adicionada para `avaliacoes.turma_disciplina_id -> turma_disciplinas(id)` com pre-check de órfãos.
    Arquivo: `supabase/migrations/20260225000001_academic_integrity_fixes.sql`.
- **Comentários:**
  - Cadeia principal de integridade está coberta; manter revisão periódica de FKs restantes.

---

## 5. Conclusão e Recomendações

### Resumo executivo (maturidade Enterprise)
O módulo Académico já tem pilares fortes de backend: publish via RPC, controle transacional com lock, RLS ativa em tabelas centrais e modelagem normalizada de `turma_disciplinas`. O problema principal hoje não é ausência de funcionalidade, é **coerência de contrato entre fluxos**. O SSOT de disciplinas foi consolidado em presets DB + overrides por escola, e os gates críticos agora são aplicados em API e banco. Para um padrão Enterprise (Workday/ServiceNow-like), o risco residual está em nomenclatura de status e governança de FKs.

### Prioridades de correção (atualizado pós-fixes)

#### ✅ Já coberto nesta sequência de PRs
1. **Hard gate backend para criação de turma**: `POST /api/escolas/[id]/turmas` agora valida currículo publicado (com ano/classe) antes do insert.
2. **Hard gate no PostgreSQL**: trigger `trg_ensure_curriculo_published` + função reforçada bloqueiam insert direto em `turmas` sem currículo publicado e sem matriz.
3. **Flag de impacto oficial**: `conta_para_media_med` adicionada e propagada no RPC `gerar_turmas_from_curriculo` para `turma_disciplinas`.
4. **Integridade de avaliações**: FK `avaliacoes.turma_disciplina_id -> turma_disciplinas(id)` adicionada com pre-check de órfãos.
5. **Pre-flight completo de publish**: valida classes esperadas e registra pendências/auditoria.
6. **Fecho acadêmico reforçado**: `status_fecho` + `trava_notas_em` bloqueiam notas/avaliações, com RPC de fecho de turma.
7. **SSOT de disciplinas**: presets DB + `school_subjects` agora são a fonte primária no install/apply.
8. **`conta_para_media_med` no cálculo oficial**: boletim/pauta anual respeitam disciplinas que não contam.
9. **Governança do catálogo global**: RPCs admin-only para gerir presets e disciplinas globais.
10. **Telemetria padronizada**: eventos de publish e fecho de turma emitidos no backend.
11. **Presets hardcoded removidos**: leituras ativas passaram a consultar `curriculum_preset_subjects`.
12. **Engine de cálculo unificada**: `pauta-grid` expõe pesos/componentes e a UI usa esses dados para calcular MT.
13. **Contexto por matrícula ativa + ano letivo ativo**: `get_aluno_dossier` retorna `matricula_ativa` e `ano_letivo_ativo`, consumido no balcão.
14. **Acoplamento financeiro por matrícula/ano**: `get_aluno_dossier` filtra mensalidades por `matricula_id` (fallback por ano letivo).
15. **Auto-preencher via DB**: `curriculum_preset_subjects` ganhou `conta_para_media_med`, `is_avaliavel`, `avaliacao_mode` e o modal usa esses campos.

#### 🔴 Alta prioridade pendente
- Sem pendências críticas após os últimos ajustes.

#### 🟡 Média prioridade pendente
1. Criar testes de contrato DB+API para evitar regressão dos gates (API e insert direto via SQL).

#### 🟢 Baixa prioridade pendente
1. Consolidar nomenclatura de status (`status_aprovacao`, `status_validacao`, `curriculo_status`) em contrato único.
2. (removido) — uso de presets hardcoded substituído por leitura em DB nos fluxos ativos.

### Hardening estrutural (refactors maiores)
- Limpar artefactos de presets hardcoded remanescentes (assets/seed) e formalizar versionamento/auditoria do catálogo global.
- Revisar integralmente a malha de FKs acadêmicas (curso_matriz ↔ turma_disciplinas ↔ avaliacoes/notas/frequencias) e impor `RESTRICT/NO ACTION` onde a regra de negócio exige.
- Criar camada única de domínio para “estado acadêmico publicável”, evitando lógica dispersa entre route handlers, server actions e funções SQL.

---

## Backlog mapeado (próximos buracos)

### 🔴 Alto impacto
1. **SSOT total no `curso_matriz`**: exigir `preset_subject_id` em todos os inserts e bloquear disciplina fora do preset por default.
2. **Contrato único de publish**: eliminar variações entre publish por classe vs publish geral e manter uma única fonte de pendências.

### 🟡 Médio impacto
1. **RLS do catálogo global**: documentar governança e elevar controles de escrita/admin.
2. **Testes de contrato DB+API**: gates de currículo publicado e criação de turmas sem regressão.
3. **Relatório de divergências**: rotina para listar disciplinas fora do preset por curso/ano.

### 🟢 Baixo impacto
1. **Padronizar mensagens de pendências**: UX unificada para metadados faltantes e overload de carga.
2. **Telemetria de publishes**: eventos com métricas de duração/pendências.
