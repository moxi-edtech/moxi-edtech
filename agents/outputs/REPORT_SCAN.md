# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T11:23:49.674784+00:00
run_id: cd3c7ab6-d94f-4dc4-af69-b5c76cc0f235
commit: 5c4964143a3e02ab88b7224ff61c2398bdb75fd5 + working tree validada antes do commit final

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

Escopo: alterações AppyPay; não certifica o repositório inteiro. Sem PASS parcial. can_merge: false.

## Blockers activos
APY-003: fluxo com pagamento/entrega de webhook no provedor ainda não exercitado; antes da ativação.
APY-004: cobertura integral do contrato 2.0.0 pendente; scanner legado não certifica gate global.

## Findings
Nenhuma violação de regra reportada neste escopo. Os itens acima são limites de validação, não findings de código sem evidência.

## Regressões
REPORT_SCAN_LAST_PASS.json ausente. Sem regressões a reportar; baseline não atualizado.

## Excepções activas
EXC-SEC-001-B e EXC-SEC-002-A para callback de máquina /api/webhooks/appypay, documentadas em agents/exceptions/.

## Validação
- 19 testes código/HTTP aprovados; fronteiras HTTP simuladas.
- Lint dos ficheiros alterados aprovado separadamente.
- Build Next de produção completo aprovado com verificação de tipos e 182 páginas, gateway desativado e credenciais fictícias. APY-002 resolvido.
- Componente real validado no navegador com fixture sintética; detalhes em VISUAL_APPYPAY.md.
- 3 cenários PostgreSQL local aprovados anteriormente; RPC financeira existente representada por fixture.
- OAuth produção verificado anteriormente sem cobrança.
- SQL aprovado aplicado anteriormente; corpo, privilégios e probe não mutável conferidos.
- Scanner legado novamente executado: zero critical/high/medium, seis marcadores LOW VALIDATED; gate legado PASS. Não implementa o contrato integral; APY-004 aberto.

Sem novo SQL, dados reais, deploy, merge ou ativação nesta finalização. APY-001 e APY-002 resolvidos; APY-003 e APY-004 registados no WARN_REGISTRY.md.
