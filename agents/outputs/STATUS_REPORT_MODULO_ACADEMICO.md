# Status Report – Módulo Académico (KLASSE)

Data da auditoria: 2026-02-25  
Escopo validado: Next.js App Router + TypeScript (`apps/web/src/**`) e Supabase SQL (`supabase/migrations/**`)

---

## 1. CATÁLOGO DE DISCIPLINAS (SSOT vs Customização)

### 1.1. Schema de Disciplinas
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - Existe catálogo por escola em `disciplinas_catalogo` (`escola_id`, `nome`, `sigla`) sem coluna explícita de escopo global/preset nessa tabela.  
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql` (CREATE TABLE `disciplinas_catalogo`).
  - Existe modelo novo separado para preset/global + customização:
    - `curriculum_presets` (catálogo base global)
    - `curriculum_preset_subjects` (disciplinas por preset)
    - `school_subjects` (override por escola)
    Arquivo: `supabase/migrations/20261127000000_curriculum_presets_tables.sql`.
  - O código de aplicação principal ainda grava disciplinas em `disciplinas_catalogo` + `curso_matriz`:
    - `apps/web/src/lib/academico/curriculum-apply.ts` (`upsertDisciplinasCatalogo`, `.from("disciplinas_catalogo")`)
    - `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts` (POST insere em `disciplinas_catalogo` e `curso_matriz`).
- **Comentários:**
  - Há **dois modelos paralelos** (legado operacional + preset novo), o que aumenta risco de divergência funcional e semântica.

### 1.2. Distinção Preset Global vs Customização da Escola
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - Distinção existe no novo modelo:
    - Global: `curriculum_preset_subjects`.
    - Custom escola: `school_subjects.escola_id`, `custom_weekly_hours`, `custom_name`.
    Arquivo: `supabase/migrations/20261127000000_curriculum_presets_tables.sql`.
  - API já consome essa distinção ao montar payload híbrido (`presetRows` + `schoolRows`).
    Arquivo: `apps/web/src/app/api/escolas/[id]/curriculo/padroes/route.ts`.
  - Porém, fluxo core de aplicação curricular ainda usa constante local `CURRICULUM_PRESETS` + escrita direta em `disciplinas_catalogo`.
    Arquivos:
    - `apps/web/src/lib/academico/curriculum-presets.ts`
    - `apps/web/src/lib/academico/curriculum-apply.ts`
- **Comentários:**
  - A distinção **existe**, mas não está unificada em todo o fluxo; hoje é "coerente em partes".

### 1.3. Flag para média / reprovação (`conta_para_media_med` ou equivalente)
- **Status: 🔴 Em Falta**
- **Evidências:**
  - Não há coluna explícita equivalente (`conta_para_media`, `impacta_aprovacao`, etc.) nos artefatos auditados do catálogo/matriz.
  - Busca textual no código/migrations não encontrou uso da flag no cálculo de aprovação/média (`rg -n "conta_para_media|impacta_aprov" ...`).
  - O mais próximo é `is_avaliavel` em `disciplinas_catalogo`, mas ele modela avaliabilidade, não necessariamente regra oficial de reprovação MED.
    Arquivos:
    - `supabase/migrations/20260305000020_academic_contract_schema.sql` (coluna `is_avaliavel`)
    - `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts` (usa `is_avaliavel`)
- **Comentários:**
  - Sem essa flag de negócio explícita, disciplinas locais podem contaminar lógica oficial de aprovação (edge case de boletim/fecho anual).

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
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - Há validações backend robustas antes de publicar:
    - Bloqueio de currículo vazio (`curriculo sem disciplinas`)
    - Pendências de metadados obrigatórios
    - Overload de carga horária
    - Mínimo de disciplinas core
    Arquivo: `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`.
  - O fluxo ocorre dentro da transação da função PL/pgSQL e usa `pg_advisory_xact_lock` (controle de concorrência).
    Arquivos:
    - `supabase/migrations/20261128000000_curriculo_publish_by_class.sql`
    - `supabase/migrations/20261128040000_fix_curriculo_publish_legacy.sql`
  - **Gap:** não há validação explícita de cobertura total “curso tem classes” + “cada classe do curso tem disciplinas” como regra formal única; valida por currículos existentes e/ou matriz, mas não garante completude global do curso em todos os cenários.
- **Comentários:**
  - Bom nível transacional, mas ainda sem contrato rígido de completude por curso inteiro.

### 2.3. Coluna de status (RASCUNHO vs PUBLICADO/ATIVO)
- **Status: 🟡 Precisa de Ajuste**
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
  - **Gap relevante:** criação manual de turma (`POST /api/escolas/[id]/turmas`) não valida status do currículo/curso antes de inserir.
    Arquivo: `apps/web/src/app/api/escolas/[id]/turmas/route.ts`.
- **Comentários:**
  - Status existe e é usado, mas ainda há bypass de regras de ciclo de vida em endpoints de escrita.

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
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - O RPC `gerar_turmas_from_curriculo` exige currículo `status = 'published'`.
    Arquivo: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`.
  - Porém o endpoint de criação manual de turma não impõe esse bloqueio.
    Arquivo: `apps/web/src/app/api/escolas/[id]/turmas/route.ts`.
  - Em `saveAndValidateTurma`, há criação/ajuste de curso e classe com `status_validacao: 'ativo'`, sem gate explícito de currículo publicado.
    Arquivo: `apps/web/src/features/turmas/actions.ts`.
- **Comentários:**
  - Regra existe parcialmente (path RPC), mas não é enforcement universal de backend.

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
  - **Risco:** políticas de presets globais permitem leitura ampla a qualquer autenticado (ok para catálogo público), mas falta política explícita de escrita/admin global (fica implicitamente bloqueada por ausência de policy DML). Isso é seguro por default, porém pouco explícito para governança.
- **Comentários:**
  - Multi-tenant está bem encaminhado, mas governança de catálogo global merece política explícita/documentada.

### 4.2. Proteção contra exclusão com dados dependentes
- **Status: 🟡 Precisa de Ajuste**
- **Evidências:**
  - Há proteção por FK em cadeias críticas:
    - `curso_matriz.disciplina_id -> disciplinas_catalogo(id) ON DELETE RESTRICT`
    - `turma_disciplinas.curso_matriz_id -> curso_matriz(id) ON DELETE RESTRICT`
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
  - API de DELETE de disciplina também bloqueia quando há vínculo em currículo publicado/ativo.
    Arquivo: `apps/web/src/app/api/escolas/[id]/disciplinas/[disciplinaId]/route.ts`.
  - **Gap estrutural:** no snapshot auditado, `avaliacoes.turma_disciplina_id` aparece como coluna obrigatória, mas não foi encontrada FK explícita para `turma_disciplinas(id)`; isso abre risco de órfãos por caminho lateral.
    Arquivo: `supabase/migrations/20260127020139_remote_schema.sql`.
- **Comentários:**
  - Não parece trivial "apagar disciplina em uso" via fluxo feliz, mas há pontos de integridade que ainda podem ser endurecidos.

---

## 5. Conclusão e Recomendações

### Resumo executivo (maturidade Enterprise)
O módulo Académico já tem pilares fortes de backend: publish via RPC, controle transacional com lock, RLS ativa em tabelas centrais e modelagem normalizada de `turma_disciplinas`. O problema principal hoje não é ausência de funcionalidade, é **coerência de contrato entre fluxos**. Existem caminhos modernos (presets globais + customização por escola) convivendo com fluxos legados (`CURRICULUM_PRESETS` em código + `disciplinas_catalogo`), e múltiplas rotas de criação de turma com enforcement desigual. Para um padrão Enterprise (Workday/ServiceNow-like), o risco está em bypass de regras de status e em governança de schema não totalmente unificada.

### Prioridades de correção

#### Alta prioridade
1. **Unificar SSOT de disciplinas**: escolher definitivamente o motor (`curriculum_preset_subjects` + `school_subjects` OU legado), com plano de migração e depreciação.
2. **Hard gate backend para criação de turma**: toda criação (API/server action/RPC) deve exigir currículo publicado e classe coberta.
3. **Adicionar flag de impacto oficial na aprovação** (`conta_para_media_med` ou equivalente) e conectar em RPCs de cálculo de resultado anual.
4. **Fechar lacunas de integridade por FK** (especialmente ligações de avaliação/nota/frequência com `turma_disciplinas`, se realmente ausentes no schema vigente).

#### Média prioridade
1. Tornar explícita política de governança do catálogo global (quem pode alterar presets globais e por qual role).
2. Criar pre-flight de completude por curso inteiro (classes esperadas x classes com matriz válida).
3. Adicionar observabilidade: logs/audit padronizados para publish + geração de turmas em todos os caminhos.

#### Baixa prioridade
1. Consolidar nomenclatura de status (`status_aprovacao`, `status_validacao`, `curriculo_status`) em contrato único.
2. Reduzir fallback de presets em memória quando DB estiver disponível para evitar drift de conteúdo.

### Quick wins (alto impacto / baixo esforço)
- Aplicar bloqueio de currículo publicado no `POST /api/escolas/[id]/turmas`.
- Criar coluna booleana explícita para impacto em aprovação e popular default seguro.
- Adicionar testes de contrato (API + RPC) para garantir que não existe criação de turma com currículo draft.

### Hardening estrutural (refactors maiores)
- Migrar completamente o fluxo de presets para DB (com versionamento e trilha de auditoria), removendo dependência do grande preset hardcoded como fonte primária.
- Revisar integralmente a malha de FKs acadêmicas (curso_matriz ↔ turma_disciplinas ↔ avaliacoes/notas/frequencias) e impor `RESTRICT/NO ACTION` onde a regra de negócio exige.
- Criar camada única de domínio para “estado acadêmico publicável”, evitando lógica dispersa entre route handlers, server actions e funções SQL.
