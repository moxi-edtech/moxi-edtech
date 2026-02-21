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
- Nenhuma alteração de schema ou dados reais foi executada.
- Validação local não foi rodada.
