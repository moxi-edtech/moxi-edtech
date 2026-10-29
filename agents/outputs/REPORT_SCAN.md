# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T15:28:20.183280+00:00
run_id: 445389da-a77d-4bbc-a28d-a176e2735b35
commit: d0b79c4a371b3856fbbd5bd02bbe613d25fae04b + working tree hashes in JSON

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 1 | 1 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
FAIL — can_merge: false. Auditoria global integral não concluída; um blocker adicional confirmado na triagem.

## Blockers activos
SEC-002-7e446b7f; APY-004: cobertura global pendente. Sem exceção de release aprovada.

## Findings
Um novo finding confirmado; os três findings anteriores foram corrigidos nos ficheiros alterados:
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

## Bloqueio adicional confirmado
```
FINDING
  id: SEC-002-7e446b7f
  regra: SEC-002
  severidade: CRITICAL
  status: FAIL
  ficheiro: apps/web/src/app/api/fiscal/saft/export/[exportId]/download/route.ts
  linha: 57-63
  evidencia: function getSupabaseAdmin() {
                  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
                  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  impacto: O endpoint humano cria cliente privilegiado para assinar downloads fiscais, sem exceção documentada de SEC-002; a operação contorna o RLS do Storage após a autorização da aplicação.
  recomendacao: Migrar a assinatura para operação de domínio de máquina estritamente autorizada ou usar a sessão com política de leitura tenant-scoped aprovada; remover getSupabaseAdmin da rota humana.
  bloqueante: true
  excecao: null
```

O cliente admin é usado em createSignedUrl dentro do handler humano (linhas 154-164). A inspeção do banco não encontrou política específica de leitura SAF-T no Storage; isso não exclui políticas genéricas, mas impede presumir que uma substituição cega preserve o fluxo. Não alterar RLS sem proposta e aprovação.

Typecheck global apps/web concluído com exit 0, sem diagnósticos. Não substitui build, auditoria ou jornada autenticada de produção.
