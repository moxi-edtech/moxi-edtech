# Aprovação necessária — Sprint 2 RAA

run_id: RAA-SPRINT2-PROGRESSAO-POLICY-20260815
timestamp: 2026-08-15

## Acção proposta

Adicionar à tabela `configuracoes_pedagogicas` a política explícita para inscrição condicional e progressão com recurso. A rota `GET /api/academico/raa/progressao` já recusa decidir quando esses campos não estão configurados.

## Diff

```diff
ALTER TABLE public.configuracoes_pedagogicas
  ADD COLUMN IF NOT EXISTS permitir_inscricao_condicional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_progressao_com_recurso boolean NOT NULL DEFAULT true;
```

## Risco

É uma alteração de schema reversível, mas muda a política académica persistida e pode liberar ou bloquear rematrículas condicionais; a aplicação deve ser validada na Escola Klasse antes de qualquer ativação por turma/regime.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-PROGRESSAO-POLICY-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-PROGRESSAO-POLICY-20260815 [motivo]`
