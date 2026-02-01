# Sessão — Resumo Completo do Ciclo Acadêmico (Full Academic Cycle)

## Escopo
- UI/Admin: `SettingsHub` e `StructureMarketplace` com MVP conceitual conectado a rotas reais.
- RPCs e DB: contratos de setup acadêmico, idempotência de geração de turmas, modelos de avaliação e validações de publicação.
- API/UI: exposição de campos acadêmicos críticos (classe, disciplina, modelos).

## Entregas Implementadas

### 1) UI — Experiência “Dona Maria”
- Dashboard conceitual com menu lateral, CTA de wizard e barra de impacto em `apps/web/src/components/escola/settings/SettingsHub.tsx`.
- Seção “Configuração Acadêmica Guiada” com cards vinculados a ações reais em `apps/web/src/components/escola/settings/StructureMarketplace.tsx`.

### 2) RPCs/DB — Contratos Acadêmicos (SSOT)
- Skeletons RPC: `get_setup_state`, `get_config_impact`, `preview_apply_changes`, `config_commit`.
- Validações P0: overlap de períodos, pesos = 100, trava de notas válida.
- Idempotência de geração de turmas via `Idempotency-Key` + audit log.

Arquivos:
- `supabase/migrations/20260305000000_rpc_academic_setup_contracts.sql`
- `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`
- `supabase/migrations/20260305000010_add_academic_setup_columns.sql`

### 3) Schema Acadêmico — Campos críticos
- `classes`: `ano_letivo_id`, `turno`, `carga_horaria_semanal`, `min_disciplinas_core`.
- `disciplinas_catalogo`: `carga_horaria_semana`, `is_core`, `is_avaliavel`, `area`, `aplica_modelo_avaliacao_id`, `herda_de_disciplina_id`.
- `turma_disciplinas`: `modelo_avaliacao_id`.

Arquivos:
- `supabase/migrations/20260305000020_academic_contract_schema.sql`
- `supabase/migrations/20260305000021_modelos_avaliacao.sql`

### 4) Publicação de Currículo — Regras P0
- `curriculo_publish` agora valida:
  - currículo vazio
  - disciplina sem modelo
  - disciplina sem carga semanal
  - sobrecarga de horas na classe
  - core mínimo insuficiente
- `curriculo_rebuild_turma_disciplinas` popula `modelo_avaliacao_id`.

Arquivo:
- `supabase/migrations/20260305000022_update_curriculo_publish_contract.sql`

### 5) API — Exposição de campos acadêmicos
- `classes` e `disciplinas` agora retornam e aceitam os novos campos.
- Novo endpoint de `modelos-avaliacao`.
- Bloqueio de edição/remoção se currículo publicado.

Arquivos:
- `apps/web/src/app/api/escolas/[id]/classes/route.ts`
- `apps/web/src/app/api/escolas/[id]/classes/[classId]/route.ts`
- `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts`
- `apps/web/src/app/api/escolas/[id]/disciplinas/[disciplinaId]/route.ts`
- `apps/web/src/app/api/escolas/[id]/modelos-avaliacao/route.ts`

### 6) UI — Editor com modal e bloqueio de publicado
- Editor modal para Classe e Disciplina.
- Banner de bloqueio para currículo publicado.
- Substituição de prompts por inputs/selects.
- CTA “Solicitar nova versão” apontando para `/admin/configuracoes/academico-completo`.

Arquivo:
- `apps/web/src/app/escola/[id]/admin/configuracoes/ConfiguracoesClient.tsx`

## Pendências sugeridas
- Adicionar banner de bloqueio diretamente nas linhas da lista (UI) e CTA “Solicitar nova versão”.
- Criar editor visual para modelos de avaliação (sem JSON raw).
- Ajustar carregamento das disciplinas por curso/classe para listas grandes (paginação).
