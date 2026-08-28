# Aprovação necessária — Agent 3
run_id:    1C1C9512-AF72-4693-8132-27CBAEC04CDA
timestamp: 2026-08-28T00:00:00-03:00

## Acção proposta
Actualizar exclusivamente mensalidades de 2026 da 4.ª classe da escola Curtume que ainda estejam pendentes e tenham valor previsto de 2.000 Kz, para 2.500 Kz. Não alterar pagamentos liquidados, mensalidades com outro valor, outras classes ou outras escolas.

Escopo validado: 175 mensalidades, 16 alunos, diferença total de 87.500 Kz.

## Diff
```sql
UPDATE public.mensalidades AS me
SET valor = 2500,
    valor_previsto = 2500,
    updated_at = now()
FROM public.matriculas AS m
JOIN public.turmas AS t ON t.id = m.turma_id
WHERE me.matricula_id = m.id
  AND m.escola_id = '3744879f-2e19-4671-8995-78604302d8c5'
  AND m.ano_letivo = 2026
  AND t.classe_id = '36c23920-64e9-4a32-98b6-2c9bccbe5c9a'
  AND me.status IN ('pendente', 'em_aberto', 'aberta', 'vencida')
  AND COALESCE(me.valor_previsto, me.valor) = 2000;
```

## Risco
Altera obrigações financeiras pendentes e aumenta o saldo devido em 87.500 Kz. A operação é reversível apenas com uma actualização compensatória baseada nos IDs afectados.

## Como aprovar
Commit com mensagem: `APPROVE: 1C1C9512-AF72-4693-8132-27CBAEC04CDA`

## Como rejeitar
Commit com mensagem: `REJECT: 1C1C9512-AF72-4693-8132-27CBAEC04CDA [motivo]`
