# Aprovação necessária — Agent 3
run_id:    RAA-SPRINT3-EXAM-MFD-20260815
timestamp: 2026-08-15

Estado: APPROVED — migration aplicada e validada em 2026-08-15.

## Acção proposta

Atualizar o contrato SQL `resolve_estado_resultado(matricula_id, disciplina_id)` para consumir sessões de exame publicadas/encerradas e calcular a MFD oficial a partir dos componentes submetidos/validados.

## Diff

Migration proposta: `supabase/migrations/20260815180000_raa_exam_mfd_ssot.sql`

Alterações comportamentais:

- sessão de recurso/extraordinário substitui a nota anterior;
- exame nacional calcula `peso_percurso × percurso + peso_exame × exame`;
- exame combinado usa a média ponderada dos componentes configurados;
- resultado incompleto continua `pendente_formula` com motivo e contagem de componentes;
- cor e estado continuam derivados exclusivamente no SSOT.

## Risco

É uma alteração de contrato SQL que afeta resultados académicos oficiais. Um erro pode classificar incorretamente alunos de exame; por isso não será aplicada sem aprovação explícita.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT3-EXAM-MFD-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT3-EXAM-MFD-20260815 [motivo]`
