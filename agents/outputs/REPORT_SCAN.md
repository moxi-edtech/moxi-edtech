# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-28T22:43:15.571266+00:00
run_id: a1338163-1df9-4a14-9f79-ff677e5f3e84
commit: b425b0bd663959385a4b6ed202666d08e87f7a9c

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
WARN

Escopo: integração AppyPay alterada; não certifica o repositório inteiro. Sem PASS parcial. can_merge: false.

## Blockers activos
APY-002: typecheck/build global não validado por dependências ausentes.
APY-003: sem fluxo de cobrança real ou sandbox no provedor; webhook não publicado.

## Findings
Nenhuma violação de regra reportada neste escopo. Os itens acima são limites de validação/execução, não findings de código inventados.

## Regressões
REPORT_SCAN_LAST_PASS.json ausente. Sem regressões a reportar; baseline não atualizado.

## Excepções activas
EXC-SEC-001-B e EXC-SEC-002-A, restritas ao callback de máquina /api/webhooks/appypay; documentadas em agents/exceptions/.

## Validação
14 testes código/HTTP; 3 cenários PostgreSQL local; typecheck strict dos módulos aprovado; autenticação de produção confirmada sem cobrança. A RPC financeira existente é fixture no teste SQL. O scanner legado não implementa o contrato 2.0.0 integralmente e seu output foi arquivado como LEGACY_REPORT_SCAN.*.

## Atualização após aprovação SQL — 2026-10-28
APY-001 resolvido: aprovação explícita registada no commit 42c9855c8. Migration 20261028224738 aplicada; hash/permissões/SECURITY INVOKER confirmados no Supabase e probe sem dados reais passou. Advisors consultados sem aviso específico AppyPay. Não houve teste financeiro real, build completo, merge ou publicação. WARN/can_merge=false preservados por APY-002 e APY-003; nenhum PASS global emitido.

Dependências recuperadas via frozen-lockfile, sem alterações de lockfile. Os 14 testes passaram novamente. Typecheck global adicional inconclusivo: interrompido após mais de seis minutos sem diagnósticos. Não é evidência de erro AppyPay nem de PASS global; APY-002 permanece aberto.

Typecheck direcionado dos módulos e das três rotas AppyPay aprovado após recuperar as dependências fixadas, usando imports/tipos reais do projeto. Não altera o estado inconclusivo do check global.
