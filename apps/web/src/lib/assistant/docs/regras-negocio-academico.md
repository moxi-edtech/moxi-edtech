# Regras de Negócio — Acadêmico, Notas e Horários

Este documento resume regras oficiais acadêmicas que o KLASSE Brain pode usar ao orientar Secretaria, Direção e Professores autorizados.

## Lançamento de notas

- O lançamento de notas é centralizado na RPC `lancar_notas_batch`.
- As rotas de professor e secretaria exigem header `Idempotency-Key`.
- O lançamento deve informar turma, disciplina, turma-disciplina, trimestre/tipo de avaliação e lista de notas.
- A nota aceita valor numérico entre 0 e 100 conforme validação de payload.
- A RPC é a fonte central para validação e persistência, reduzindo divergência entre portais.

Fontes:
- `apps/web/src/app/api/professor/notas/route.ts`
- `apps/web/src/app/api/secretaria/notas/route.ts`
- `agents/outputs/STATUS_REPORT_PIPELINE_APROVACAO_NOTAS.md`

## Permissão para notas

- Professor e Secretaria usam rotas distintas, mas o lançamento não deve ignorar validação de escola e papel.
- A rota de Secretaria verifica autorização para gestão de turmas antes de chamar a RPC.
- A regra de negócio de professor atribuído/admin fica centralizada na RPC.

Fontes:
- `apps/web/src/app/api/secretaria/notas/route.ts`
- `agents/outputs/STATUS_REPORT_PIPELINE_APROVACAO_NOTAS.md`

## Travas de período e turma

- O sistema bloqueia lançamento/alteração de notas quando a turma está fechada.
- O sistema também bloqueia lançamento/alteração quando o período letivo está travado.
- Essas travas são regras operacionais; o assistente deve orientar o usuário a verificar fecho de turma/período em vez de sugerir alteração direta.

Fonte: `agents/outputs/STATUS_REPORT_PIPELINE_APROVACAO_NOTAS.md`

## Fórmulas e modelos de avaliação

- `modelos_avaliacao.formula` é a fonte principal para componentes e pesos.
- A pauta geral e pauta anual devem usar o modelo oficial resolvido pelo backend.
- Ainda existe risco residual de divergência com engines legadas; se a pergunta envolver cálculo avançado, o assistente deve responder com cautela e indicar que o cálculo oficial vem do backend/modelo de avaliação.

Fonte: `agents/outputs/STATUS_REPORT_PIPELINE_APROVACAO_NOTAS.md`

## Notificações de notas

- Após lançamento por professor, o sistema pode notificar alunos.
- Notas abaixo da média mínima operacional de 10 podem gerar notificação específica de nota baixa.
- O assistente não deve enviar notificação diretamente; deve apenas explicar que o fluxo oficial pode disparar notificações.

Fonte: `apps/web/src/app/api/professor/notas/route.ts`

## Horários

- O sistema bloqueia conflitos de professor e sala no mesmo slot.
- No modo de publicação, o fluxo também valida cobertura de carga horária.
- O scheduler automático evita colisões de turma, professor e sala por slot.

Fonte: `agents/outputs/STATUS_REPORT_PIPELINE_APROVACAO_NOTAS.md`

## O que o assistente pode dizer

- Pode explicar por que o lançamento exige idempotency key.
- Pode explicar bloqueio por turma fechada ou período travado.
- Pode orientar o usuário a usar a tela de notas/pauta correta.
- Pode resumir a regra geral de cálculo sem inventar fórmula específica não documentada.

## O que o assistente não pode inventar

- Não inventar média, fórmula ou regra de aprovação quando não estiver no modelo oficial.
- Não prometer destravar período/turma.
- Não lançar, alterar ou apagar notas diretamente.
