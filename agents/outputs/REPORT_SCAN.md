# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-11-02T17:59:22.031680+00:00
run_id: 846c2480-2f5b-4227-be24-b654bf3b4557
commit: 0359a277f5787206c44e73cbee4924fc77a09213 + working-tree hashes in REPORT_SCAN.json

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 4 | 4 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
FAIL — can_merge: false. Quatro blockers legados confirmados. Implementação WhatsApp sandbox coberta por 39 testes e typecheck global, sem PASS parcial nem auditoria global integral certificada.

## Blockers activos
- SEC-001-b2dab294
- SEC-002-ac701c12
- SEC-003-1814c056
- SEC-002-7e446b7f

## Findings
```
FINDING
  id: SEC-001-b2dab294
  regra: SEC-001
  severidade: CRITICAL
  status: FAIL
  ficheiro: apps/web/src/app/api/teste-rpc/route.ts
  linha: 6-64
  evidencia: export async function GET(request: Request) {
                      const { data, error } = await supabase.rpc(
                        'secretaria_list_alunos_kf2',
  impacto: O endpoint executa uma RPC com escolaId recebido do pedido sem resolver a escola do utilizador; resolveEscolaIdForUser está ausente.
  recomendacao: Exigir sessão e resolver a escola com resolveEscolaIdForUser antes de qualquer RPC, removendo o fallback fixo.
  bloqueante: true
  excecao: null
```

```
FINDING
  id: SEC-002-ac701c12
  regra: SEC-002
  severidade: CRITICAL
  status: FAIL
  ficheiro: apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/delete/route.ts
  linha: 9-14
  evidencia:   const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
                  if (!url || !key) return null
                  return createAdminClient<Database>(url, key, {
  impacto: getSupabaseAdmin cria um cliente privilegiado dentro de endpoint humano, fora das exceções documentadas.
  recomendacao: Substituir o cliente privilegiado por operação autenticada com RLS ou RPC de domínio restrita e aprovada.
  bloqueante: true
  excecao: null
```

```
FINDING
  id: SEC-003-1814c056
  regra: SEC-003
  severidade: CRITICAL
  status: FAIL
  ficheiro: apps/web/src/app/api/escola/[id]/admin/calendario/copiar-eventos/route.ts
  linha: 33-35
  evidencia:       .from('anos_letivos')
                      .select('id, ano')
                      .in('id', [fromAnoId, toAnoId]);
  impacto: A seleção de anos letivos depende apenas dos IDs recebidos e não contém o filtro obrigatório de escola; não existe .eq('escola_id', ...) neste ficheiro.
  recomendacao: Adicionar .eq('escola_id', userEscolaId) às consultas de anos_letivos e calendario_eventos antes da cópia.
  bloqueante: true
  excecao: null
```

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
  impacto: O endpoint humano cria getSupabaseAdmin para assinar downloads fiscais, contornando RLS do Storage, sem exceção documentada.
  recomendacao: Usar operação de domínio de máquina restrita ou sessão com política tenant-scoped aprovada, removendo o cliente privilegiado da rota humana.
  bloqueante: true
  excecao: null
```

## Regressões
REPORT_SCAN_LAST_PASS.json ausente; sem regressões formais a reportar.

## Excepções activas
Mantidas apenas as exceções AppyPay já documentadas no repositório. Endpoint novo é jobs/máquina e está excluído das regras de endpoints humanos pelo próprio contrato. Nenhuma nova exceção de release foi aprovada.

## Verificação WhatsApp Flow
39 testes AppyPay/Flow/HTTP aprovados. Lint dos módulos de produção alterados sem erros; typecheck isolado e global apps/web aprovados. Sem build Next completo novo. Handler default off, sandbox apenas, HMAC Meta antes de RSA/AES, token vinculado e expirável, limite de corpo e no-store. Store fictício separado das propinas reais, transições CAS e nenhum retry de POST incerto. SQL ainda proposto; nenhuma execução Postgres alegada. Pendências APY-010/APY-011 registadas. Publicação permanece bloqueada pelo gate global e por falta de SQL/segredos/validação no telefone.

## Seguimento SQL aprovado — 2026-11-02
APY-010 resolvido: migração privada instalada com SHA aprovado; RLS, privilégios, índices e testes de fixture revertidos passaram. Meta App Secret/token continuam ausentes; nenhuma mensagem ou publicação. Quatro blockers legados e can_merge=false mantidos; esta verificação não é nova certificação global.
