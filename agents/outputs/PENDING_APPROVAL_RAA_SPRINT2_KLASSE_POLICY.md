# Aprovação aplicada — Agent 3
run_id:    RAA-SPRINT2-KLASSE-POLICY-20260815
timestamp: 2026-08-15T00:00:00Z

## Acção proposta

Criar a configuração mínima do RAA para a Escola KLASSE
(`f406f5a7-a077-431c-b118-297224925726`) na tabela
`public.configuracoes_pedagogicas`, sem alterar notas, matrículas ou resultados.

Valores propostos:

- `permitir_progressao_com_recurso = true`
- `permitir_inscricao_condicional = false`

O segundo valor mantém a matrícula seguinte bloqueada até existir decisão jurídica
final, evitando liberar progressão condicional sem decisão institucional explícita.

## Diff SQL proposto

```sql
BEGIN;

INSERT INTO public.configuracoes_pedagogicas (
  escola_id,
  permitir_progressao_com_recurso,
  permitir_inscricao_condicional
)
VALUES (
  'f406f5a7-a077-431c-b118-297224925726',
  true,
  false
)
ON CONFLICT (escola_id) DO UPDATE
SET permitir_progressao_com_recurso = EXCLUDED.permitir_progressao_com_recurso,
    permitir_inscricao_condicional = EXCLUDED.permitir_inscricao_condicional,
    updated_at = now();

COMMIT;
```

## Risco

Esta operação altera a política operacional de progressão da escola. Não aprova
alunos nem cria mensalidades, mas passa a permitir que o motor produza decisões
de recurso quando as notas, faltas e demais dados estiverem completos.

## Verificação pós-aplicação

```sql
SELECT escola_id, permitir_progressao_com_recurso,
       permitir_inscricao_condicional
FROM public.configuracoes_pedagogicas
WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726';
```

## Resultado

Aprovado e aplicado em 2026-08-15. A política foi persistida na Escola KLASSE e
cinco matrículas reais foram validadas via `resolve_raa_progression_for_matricula`.
Todas retornaram `pendente / dados_pendentes`, preservando o bloqueio seguro até
existirem notas e factos académicos completos.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-KLASSE-POLICY-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-KLASSE-POLICY-20260815 [motivo]`
