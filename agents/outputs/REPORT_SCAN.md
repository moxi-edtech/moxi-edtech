# KLASSE — Revalidação dirigida de segurança PR #322

Run: 2026-11-05T15:30:38.023844+00:00 | Fonte: 1b0ce246f | Resultado: WARN | can_merge: false

## Corrigido no código desta PR
- **SEC-001:** eliminada a rota pública de diagnóstico `/api/teste-rpc`, que expunha dados, URL de Supabase e stack traces.
- **SEC-002:** eliminadas service role e exclusões em cascata. A API utiliza a sessão, resolução de escola, autorização de gestão e RLS, e arquiva a turma sem apagar matrículas, notas ou frequência. Um trigger auditável existente regista o UPDATE atomicamente.
- SEC-003 da cópia de calendário já estava corrigido.

## Verificações
- 5 testes de contrato de segurança e 148 regressões académicas aprovados.
- O scanner local genérico reportou 0 CRITICAL, 0 HIGH, 6 LOW, mas NÃO certifica todas as regras AGENTS.md.
- Endpoints hospedados e efeito real com auth/RLS ainda não homologados; três migrações da PR continuam por aplicar.
- A matriz global de MVs, cache, REFRESH CONCURRENTLY e as rotas obrigatórias ainda não estão certificadas.

## Gate
**WARN / can_merge=false** — não tratar os testes dirigidos como aprovação de merge.

---

## Relatório anterior (histórico, sem certificação vigente)

# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp: 2026-11-05T15:08:08.306099+00:00
run_id: 510adf7d-65a8-4abf-8050-486309cda21e
commit: 73203326085a1728e51bb2a72f870d37ea7a07f4

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | 2 | 2 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
| REGRESSION | 0 | 0 |

## Veredito
FAIL — can_merge: false.

Revalidação dirigida dos bloqueios do relatório anterior, sem certificação global das restantes rotas. Ambos os ficheiros abaixo são idênticos à main remota `89cdaca62`; estes problemas não foram introduzidos pelo Balcão. A autorização para fazer merge não foi interpretada como uma exceção às regras CRITICAL do contrato.

## Blockers activos
SEC-001-b2dab294, SEC-002-ac701c12.

## Findings
```
FINDING
  id: SEC-001-b2dab294
  regra: SEC-001
  severidade: CRITICAL
  status: FAIL
  ficheiro: apps/web/src/app/api/teste-rpc/route.ts
  linha: 6-10,61-64
  evidencia: export async function GET(request: Request) {
    const escolaId = searchParams.get('escolaId') || 'f406f5a7-a077-431c-b118-297224925726';
      const { data, error } = await supabase.rpc(
  impacto: O endpoint executa consultas com escola recebida do pedido sem resolver a escola do utilizador autenticado.
  recomendacao: Exigir sessão e resolver a escola por resolveEscolaIdForUser antes de executar qualquer consulta.
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
  linha: 9-14,34-35
  evidencia:   const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) return null
  return createAdminClient<Database>(url, key, {
  impacto: A exclusão de turma utiliza um cliente privilegiado num endpoint humano fora das exceções aprovadas.
  recomendacao: Substituir o cliente privilegiado por operação autenticada com RLS e autorização de domínio sem dispensar os controlos de escola.
  bloqueante: true
  excecao: null
```

## Regressões
REPORT_SCAN_LAST_PASS.json ausente; nenhuma REGRESSION reportável.

## Excepções activas
Nenhuma exceção aplicável aos dois endpoints. A exceção estrita EXC-SECRET-BALCAO-LOCAL de credenciais públicas dos serviços descartáveis foi documentada separadamente e verificada em 11 testes; não dispensa regras de autorização de API.

## Bloqueio anterior resolvido
SEC-003-23f395db não se mantém: copiar-eventos já filtra escola nas consultas de anos e calendário.

## Validação da alteração do Balcão
148 testes locais, integração dos formulários com PostgreSQL e testes SQL de auditoria aprovados; tipos e lint do último escopo aprovados. Os checks remotos da PR #322 iniciaram e ainda não tinham terminado neste report. AUT-006 autenticado hospedado permanece pendente; os testes de transporte/autenticação/Storage usam fixtures explícitas.
