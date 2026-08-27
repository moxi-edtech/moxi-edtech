# Apply diff — configuração graciosa de classe de exame

run_id: 8F2C9D1A-EXAME-GRACIOSIDADE
timestamp: 2026-08-15

## Acção proposta
Tornar a configuração de classe de exame explícita no formulário de turma, exibindo o calendário efetivo, os meses cobrados e o impacto de alterar uma regra já usada.

## Escopo
- Apenas UI do formulário TurmaForm.tsx.
- Sem alteração de schema, mensalidades existentes ou contrato SQL.
- Período exibido é derivado do ano letivo selecionado e da regra já implementada.

## Risco
Baixo. A alteração é informativa e não muda a regra financeira nem grava novos campos.

## Reversão
Um único git revert do commit que contenha este diff.
