# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T12:24:23.769686+00:00
run_id: 069d9a59-315d-4cb9-8a45-c28be752f334
commit: 5914e1c4665b0a88b64a0f93fa0f75f49fe41a81

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 3 | 3 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
FAIL
can_merge: false
A nova integração está validada no escopo descrito; a liberação global está bloqueada por violações anteriores ao AppyPay confirmadas abaixo. Não emitir PASS parcial nem tratar um build aprovado como liberação contratual.

## Blockers activos
SEC-001-b2dab294
SEC-002-ac701c12
SEC-003-23f395db

## Findings
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
FINDING
  id: SEC-003-23f395db
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

## Regressões
REPORT_SCAN_LAST_PASS.json não existe. Os três ficheiros acima são byte a byte idênticos a origin/main; não foram introduzidos pelo AppyPay. Isto não os transforma em PASS nem em exceções.

## Excepções activas
EXC-SEC-001-B e EXC-SEC-002-A restritas ao callback de máquina AppyPay, documentadas em agents/exceptions/. Nenhuma exceção aplicada aos três blockers globais.

## Validação AppyPay
29 testes código/HTTP, seis grupos SQL locais de serviços, build completo com tipos e 182 páginas aprovados. Lint zero erros/um aviso preexistente. Runtime local rejeita pedidos sem assinatura, grandes, inválidos e sem sessão. Interface real com API sintética validada. Não houve cobrança real.
SQL de serviços aprovado e instalado: migration 20261029121743; corpo MD5 64672e0d92eeed6513c2266ce996d1b0 igual ao aprovado; RLS/índices/negação anon/authenticated conferidos, probe não mutável aprovado e zero referências de serviço. Advisor INFO de tabela sem políticas é intencional para o worker privado.

## Limites do gate global
Preflight encontrou 114 candidatos SEC-001, quatro SEC-002 e oito SEC-003. Só os três acima foram confirmados com evidência completa; candidatos não são findings e não comprovam exploração. Os restantes e a matriz MV integral permanecem sem certificação, registados em APY-004. Sem bypass, merge ou deploy com este FAIL.
