# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T15:28:20.183280+00:00
run_id: 445389da-a77d-4bbc-a28d-a176e2735b35
commit: d0b79c4a371b3856fbbd5bd02bbe613d25fae04b + working tree hashes in JSON

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
WARN — can_merge: false. Auditoria global integral não concluída; não é PASS parcial. Nenhum finding novo confirmado nesta reverificação restrita.

## Blockers activos
APY-004: cobertura global pendente. Sem exceção de release aprovada.

## Findings
Sem novos findings com evidência completa. Os três findings anteriores foram corrigidos nos ficheiros alterados:
- SEC-001-b2dab294: diagnóstico público retirado; GET responde 404 sem RPC ou consultas.
- SEC-002-ac701c12: removido cliente privilegiado; sessão/escola/permissão verificadas. Exclusão bloqueada com 409, pois existem FKs CASCADE para dados académicos e cobrança. Nenhum DELETE é executado.
- SEC-003-23f395db: consultas de anos e eventos filtram a escola resolvida. Teste injeta anos/eventos da escola B e prova ausência de cópia cruzada.

30 testes AppyPay/HTTP e legado aprovados. Lint dos três endpoints sem erros. Testes usam fixtures, sem alterar dados de produção.

## Regressões
REPORT_SCAN_LAST_PASS.json ausente. Sem regressões formais a reportar.

## Excepções activas
Mantidas apenas exceções documentadas das rotas AppyPay e tabela privada. Proposta de exceção de release recusada pelo utilizador; não aplicada.

## Limites da auditoria
Os candidatos do scanner global ainda requerem triagem segundo o contrato completo, incluindo a matriz MV. A correção de três violações não certifica os restantes endpoints. Não copiar este report para LAST_PASS.
