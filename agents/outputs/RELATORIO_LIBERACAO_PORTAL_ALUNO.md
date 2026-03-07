# RELATÓRIO — Backlog de Liberação do Portal do Aluno (KLASSE)
Data: 2026-03-06
Escopo: Portal do Aluno, Licenças, Assinaturas

## Estado atual
- Fonte de verdade: `alunos.acesso_liberado` (boolean).
- Métricas via RPC `get_metricas_acesso_alunos`.
- Contagem de licenças usa plano (`app_plan_limits.max_alunos`) e alunos com acesso liberado.

## Backlog recomendado (não obrigatório)

### 1) Ledger de acessos (tabela dedicada)
**Motivo**: histórico e auditoria de ativações/revogações.
**Proposta**: criar `aluno_portal_access` com:
- `id`, `escola_id`, `aluno_id`, `status` (ativo/revogado), `created_at`, `revoked_at`, `created_by`, `revoked_by`, `motivo`.

### 2) Migração gradual
- Script para popular a nova tabela a partir de `alunos.acesso_liberado`.
- Manter `acesso_liberado` como cache para UI até estabilizar.

### 3) Métricas e limites
- Atualizar `get_metricas_acesso_alunos` para ler do ledger.
- Atualizar UI (Licenças Disponíveis) para usar o ledger.

## Observações
- Esta melhoria é recomendada apenas se houver exigência de auditoria formal ou integrações externas.
- O estado atual atende a necessidade operacional sem complexidade extra.
