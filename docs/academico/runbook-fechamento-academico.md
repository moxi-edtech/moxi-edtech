# Runbook — Fechamento Académico (Trimestre/Ano)

## Objetivo
Executar o fechamento académico com segurança operacional, evitando perda de dados e garantindo rastreabilidade.

## Owner
- David I Chocalie

## Pré-condições
- Ano letivo e período letivo válidos (para `fechar_trimestre`).
- Sanidade pré-fechamento validada (`/api/secretaria/fechamento-academico/sanidade`).
- Não existir outro fechamento em execução para a mesma escola.
- Janela de manutenção comunicada para secretaria e direção.

## Sequência operacional (guardrails)
1. Executar **sanidade** e resolver pendências críticas.
2. Confirmar parâmetros (ano/periodo/turmas) e registrar motivo operacional.
3. Verificar ausência de run ativo (o backend bloqueia concorrência).
4. Iniciar o fechamento assíncrono.
5. Acompanhar estados no painel operacional até `DONE`.

## Estados do job
- `PENDING_VALIDATION`
- `CLOSING_PERIOD`
- `FINALIZING_ENROLLMENTS`
- `GENERATING_HISTORY`
- `OPENING_NEXT_PERIOD`
- `DONE` ou `FAILED`

## Monitoramento
- `GET /api/secretaria/fechamento-academico?run_id=...`
- Telemetria: `GET /api/secretaria/fechamento-academico/telemetria?days=30`

## Rollback (manual)
- Se falhar em `CLOSING_PERIOD` ou `FINALIZING_ENROLLMENTS`, avaliar `retry` com motivo.
- Se falhar em `GENERATING_HISTORY`, evitar reprocesso sem validação legal.
- Para reabertura: seguir política de snapshot legal e auditoria obrigatória.

## Auditoria
- Cada etapa grava `audit_logs` com `FECHAMENTO_ACADEMICO_STEP`.
- Exceções críticas devem ter justificativa auditada.

## Checklist rápido
- [ ] Sanidade executada sem CRITICAL
- [ ] Parâmetros confirmados (ano/periodo/turmas)
- [ ] Sem runs ativos
- [ ] Janela comunicada
- [ ] Execução acompanhada até `DONE`
