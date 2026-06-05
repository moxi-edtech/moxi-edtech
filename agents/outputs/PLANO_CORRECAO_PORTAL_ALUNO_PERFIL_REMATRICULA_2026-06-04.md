# Plano de Correção — Portal do Aluno: Perfil, Senha e Rematrícula

data: 2026-06-04
status: EM_EXECUCAO
veredito_inicial: FAIL
veredito_atual: WARN
blockers_iniciais: 4
blockers_ativos: 0

## Objetivo

Fechar os gaps identificados na evolução de atualização cadastral, alteração de senha e confirmação online de rematrícula, preservando isolamento por escola, segurança da conta e idempotência.

## Ordem de ataque

| Ordem | Finding | Severidade | Estado | Ação |
|---|---|---|---|---|
| 1 | GAP-AUTH-001 | HIGH | CONCLUÍDO | Senha atual, política forte e auditoria |
| 2 | GAP-REM-001 | HIGH | CONCLUÍDO | Verificação financeira fail-closed |
| 3 | GAP-REM-002 | HIGH | CONCLUÍDO | RPC transacional e índice único |
| 4 | GAP-SEC-001 | CRITICAL | CONCLUÍDO | RLS restrita e RPC própria de contatos |
| 5 | GAP-REM-003 | MEDIUM | CONCLUÍDO | Janela explícita de abertura da rematrícula |
| 6 | GAP-PERFIL-001 | MEDIUM | CONCLUÍDO | Email de contato separado do login/Auth |
| 7 | GAP-UI-001 | LOW | CONCLUÍDO | `RematriculaBanner` consolidado em implementação única |
| 8 | GAP-TEST-001 | MEDIUM | PARCIAL | Assertions SQL executadas; testes automatizados permanentes pendentes |

## Findings

FINDING
  id:            GAP-SEC-001-96faaea4
  regra:         GAP-SEC-001
  severidade:    CRITICAL
  status:        PASS
  ficheiro:      supabase/migrations/20270604193241_harden_alunos_rls_self_contact_update.sql
  linha:         3-166
  evidencia:     Políticas separadas; RPC aluno_atualizar_contatos_proprios; anon sem EXECUTE.
  impacto:       Update direto próprio/lateral bloqueado; atualização própria limitada a contatos.
  recomendacao:  Manter assertions de aluno e staff no pipeline de segurança.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-AUTH-001-ef64941b
  regra:         GAP-AUTH-001
  severidade:    HIGH
  status:        PASS
  ficheiro:      apps/web/src/app/api/aluno/perfil/senha/route.ts
  linha:         5-63
  evidencia:     RequestSchema forte; signInWithPassword antes de updateUser; audit_logs.
  impacto:       Alteração de senha exige conhecimento da senha atual e política forte.
  recomendacao:  Adicionar rate limit específico para tentativas de reautenticação.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-REM-001-60065139
  regra:         GAP-REM-001
  severidade:    HIGH
  status:        PASS
  ficheiro:      apps/web/src/app/api/aluno/rematricula/confirmar/route.ts
  linha:         27-59
  evidencia:     Endpoint delega confirmação à RPC transacional; erro financeiro retorna 403.
  impacto:       Pendências e falhas de validação financeira bloqueiam a confirmação.
  recomendacao:  Monitorar erros FINANCEIRO da RPC.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-REM-002-60065139
  regra:         GAP-REM-002
  severidade:    HIGH
  status:        PASS
  ficheiro:      supabase/migrations/20270604194700_aluno_rematricula_idempotente.sql
  linha:         3-198
  evidencia:     Índice único parcial; advisory lock; RPC aluno_confirmar_rematricula.
  impacto:       Chamadas repetidas reutilizam exatamente a mesma candidatura.
  recomendacao:  Manter teste concorrente/idempotente no pipeline.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-REM-003-77e0d225
  regra:         GAP-REM-003
  severidade:    MEDIUM
  status:        PASS
  ficheiro:      supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql
  linha:         3-299
  evidencia:     Tabela rematricula_janelas; RLS; RPC exige janela ativa entre data_inicio e data_fim.
  impacto:       O portal só libera rematrícula quando a escola abre uma janela operacional explícita.
  recomendacao:  Criar tela de secretaria para gerir as janelas com auditoria operacional.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-REM-003-PENDING
  regra:         GAP-REM-003
  severidade:    MEDIUM
  status:        PASS
  ficheiro:      agents/outputs/PENDING_APPROVAL_PORTAL_ALUNO_REMATRICULA_JANELA.md
  linha:         1-139
  evidencia:     Aprovado, aplicado, registrado e validado com rollback.
  impacto:       A aprovação pendente foi encerrada sem deixar schema parcialmente aplicado.
  recomendacao:  Manter evidências em `PENDING_APPROVAL_PORTAL_ALUNO_REMATRICULA_JANELA.md`.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-PERFIL-001-b534cb7b
  regra:         GAP-PERFIL-001
  severidade:    MEDIUM
  status:        PASS
  ficheiro:      apps/web/src/app/api/aluno/perfil/dados/route.ts
  linha:         23-93
  evidencia:     GET expõe login_portal separado; PUT retorna authEmailUpdated=false.
  impacto:       O aluno pode atualizar email de contato sem alterar o login/Auth usado para acesso ao portal.
  recomendacao:  Manter alteração de email Auth restrita a fluxo administrativo com service role e auditoria.
  bloqueante:    false
  excecao:       null

FINDING
  id:            GAP-UI-001-a74191cf
  regra:         GAP-UI-001
  severidade:    LOW
  status:        PASS
  ficheiro:      apps/web/src/components/aluno/dashboard/RematriculaBanner.tsx
  linha:         1
  evidencia:     export { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";
  impacto:       As telas do portal do aluno passam a usar a mesma lógica de status, dívida e confirmação de rematrícula.
  recomendacao:  Manter novas mudanças de rematrícula apenas no componente canônico `components/aluno/home/RematriculaBanner.tsx`.
  bloqueante:    false
  excecao:       null

## Critérios de aceite

- [x] Alteração de senha exige senha atual válida.
- [x] Nova senha cumpre a política forte do sistema.
- [x] Alteração de senha gera auditoria sem registrar credenciais.
- [x] Falha na consulta financeira bloqueia rematrícula.
- [x] Uma rematrícula ativa do portal por aluno/escola/ano.
- [x] Aluno não consegue alterar outro aluno diretamente pelo Supabase.
- [x] Rematrícula só aparece durante janela explicitamente aberta.
- [x] Email de contato do perfil não é confundido com login/Auth.
- [x] Existe apenas uma implementação efetiva de `RematriculaBanner`.
- [x] Secretaria/Admin consegue gerir janelas de rematrícula pela UI.
- [ ] Testes automatizados permanentes cobrem autorização, falhas externas e duplicidade.

## Evidências de execução

| Área | Evidência | Resultado |
|---|---|---|
| RLS aluno | update direto próprio `0`; update lateral `0`; RPC própria `1` | PASS |
| RLS staff | update direto `1` | PASS |
| RPC contatos | `anon` sem EXECUTE; `authenticated` com EXECUTE | PASS |
| Rematrícula idempotente | primeira chamada `reused=false`; segunda `reused=true`; total `1` | PASS |
| Rematrícula financeira | pendência retorna `FINANCEIRO: possui pendências financeiras` | PASS |
| Rematrícula janela | sem janela retorna `DATA: período de rematrícula não está aberto`; com janela sintética idempotência preservada | PASS |
| Rematrícula janela RLS | tabela, índice único, 4 policies e RPC sem `anon` confirmados | PASS |
| Perfil email/Auth | `Email de Contato` editável; `Login do Portal` bloqueado; Auth não alterado pelo PUT | PASS |
| UI rematrícula | `dashboard/RematriculaBanner` reexporta `home/RematriculaBanner`; lint direcionado PASS | PASS |
| UI janelas rematrícula | API e tela de gestão criadas; typecheck e lint direcionado PASS | PASS |
| Dados de teste | candidaturas portal `0`; ano sintético não persistido | PASS |
| Qualidade | typecheck, lint e diff check | PASS |

## Artefatos aplicados

- `supabase/migrations/20270604193241_harden_alunos_rls_self_contact_update.sql`
- `supabase/migrations/20270604194700_aluno_rematricula_idempotente.sql`
- `supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql`
- `apps/web/src/app/api/aluno/perfil/dados/route.ts`
- `apps/web/src/app/api/aluno/perfil/senha/route.ts`
- `apps/web/src/app/api/aluno/rematricula/status/route.ts`
- `apps/web/src/app/api/aluno/rematricula/confirmar/route.ts`
- `apps/web/src/components/aluno/tabs/TabPerfil.tsx`
- `apps/web/src/types/supabase-augment.ts`

## Artefatos de aprovação encerrados

- `agents/outputs/PENDING_APPROVAL_PORTAL_ALUNO_REMATRICULA_JANELA.md`
- `agents/outputs/APPLY_DIFF_PORTAL_ALUNO_GAP_REM_003.md`
- `agents/outputs/APPLY_DIFF_PORTAL_ALUNO_GAP_PERFIL_001.md`
- `agents/outputs/APPLY_DIFF_PORTAL_ALUNO_GAP_UI_001.md`
- `agents/outputs/APPLY_DIFF_PORTAL_ALUNO_REMATRICULA_JANELAS_UI.md`

## Riscos restantes

1. `GAP-TEST-001`: assertions foram executadas manualmente em rollback, mas ainda não estão num pipeline automatizado.

## Próxima ordem recomendada

1. Criar testes automatizados de segurança e concorrência.

## Progresso

- [x] GAP-AUTH-001 — senha atual, política forte e auditoria implementadas
- [x] GAP-REM-001 — consultas financeiras agora falham de forma fechada
- [x] GAP-REM-002 — índice único e RPC transacional idempotente aplicados
- [x] GAP-SEC-001 — RLS separada, mutações diretas restritas a staff e RPC própria validada
- [x] GAP-REM-003 — janela explícita aplicada e validada
- [x] GAP-PERFIL-001 — email de contato separado do login/Auth
- [x] GAP-UI-001 — `RematriculaBanner` consolidado
- [ ] GAP-TEST-001
