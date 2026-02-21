# Session Summary — Curriculum Presets Refactor

## Scope
- Refatoração completa de `curriculum-presets` com novas keys, componentes e carga horária semanal.
- Inclusão de cursos técnicos de saúde (ITS 2022), industriais (RETFOP) e extensões do PDF completo com metadados/siglas.
- Propagação das novas keys nas telas de onboarding/configurações e nos fluxos de instalação.

## Key Changes
- Novos `CurriculumKey` e `CurriculumDisciplineBlueprint` com `componente` e `horas`.
- Presets técnicos de saúde adicionados: análises, enfermagem, estomatologia, farmácia, fisioterapia, nutrição e radiologia.
- `carga_horaria_semanal` agora preenchida no `curso_matriz` a partir do preset.
- Alias de curso atualizado para novas siglas (`ACL`, `ESTO`, `FARM`, `FISI`, `NUTR`).

## Updated Course Codes
- `tec_saude_analises` → `ACL`
- `tec_saude_enfermagem` → `ENF`
- `tec_saude_estomatologia` → `ESTO`
- `tec_saude_farmacia` → `FARM`
- `tec_saude_fisioterapia` → `FISI`
- `tec_saude_nutricao` → `NUTR`
- `tec_saude_radiologia` → `RAD`
- `tec_construcao_civil` → `CC`
- `tec_energia_eletrica` → `EL`
- `tec_mecanica_manut` → `MEC`
- `tec_informatica_sistemas` → `TIS`
- `tec_desenhador_projectista` → `DP`
- `tec_electronica_telecom` → `ET`
- `tec_electronica_automacao` → `EA`
- `tec_energias_renovaveis` → `ER`
- `tec_geologia_petroleo` → `GP`
- `tec_perfuracao_producao` → `PP`
- `tec_minas` → `MIN`
- `tec_producao_metalomecanica` → `PM`
- `tec_informatica` → `TI`
- `tec_gestao_sistemas` → `TGS`
- `tec_informatica_gestao` → `TIG`

## Files Touched
- `apps/web/src/lib/academico/curriculum-presets.ts`
- `apps/web/src/lib/academico/curriculum-apply.ts`
- `apps/web/src/lib/academico/turma-utils.ts`
- `apps/web/src/lib/courseTypes.ts`
- `apps/web/src/components/escola/settings/CurriculumBuilder.tsx`
- `apps/web/src/components/escola/configuracoes/CurriculumPresetSelector.tsx`
- `apps/web/src/components/escola/onboarding/CurriculumPresetSelector.tsx`
- `apps/web/src/components/escola/onboarding/AcademicStep2.tsx`
- `apps/web/src/features/curriculum/actions.ts`
- `apps/web/src/app/api/escolas/[id]/classes/route.ts`
- `apps/web/src/app/api/escola/[id]/admin/curriculo/apply-preset/route.ts`
- `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts`

## Notes
- API de edição de disciplina sincroniza `turma_disciplinas` quando carga/horário/avaliação mudam, evitando desync.
- Backfill remoto alinhou `turma_disciplinas` das turmas CFB com o currículo publicado.
- Publicação de currículo agora é por classe (coluna `classe_id` em `curso_curriculos` + novos índices únicos).
- RPC `curriculo_publish` aceita `p_classe_id` e permite `bulk publish` por curso (todas as classes na mesma versão).
- Migration aplicada no Supabase: `20261128000000_curriculo_publish_by_class.sql`.
- Presets MED migrados para o DB: tabelas `curriculum_presets`, `curriculum_preset_subjects`, `school_subjects` + seed gerado de `CURRICULUM_PRESETS`.
- Endpoint `GET /api/escolas/[id]/curriculo/padroes` fornece padrão MED (DB com fallback ao preset local).
- Geração de turmas validada por classe: API e RPC exigem currículo publicado para cada classe.
- Validação local não foi rodada.

## Avaliação (Fórmulas no DB)
- `modelos_avaliacao` estendido com `tipo`, `regras` e `formula` para suportar PAP/estágio/isencão sem hardcode.
- Resolver de modelo centralizado em `apps/web/src/lib/academico/avaliacao-utils.ts` com fallback ao default.
- APIs de pauta (`professor`, `mini-pauta`, `pauta-grid`, `pauta-trimestral`) agora usam modelo do DB.
- Configurações/onboarding agora listam modelos reais via `/api/escolas/[id]/modelos-avaliacao`.

## Backlog Avaliação
- Seed inicial de modelos `pap`, `estagio` e `final_unica` com regras padrão.
- Resolver isenção por regra (ex.: média anual >= X) e refletir na pauta/boletim.
- Ajustar PDFs oficiais para renderizar modelo não trimestral.
