# Auditoria dos botões e autorização da secretaria

Data: 2026-11-05. Base auditada: `a9f2573fd`. Escopo dirigido ao Balcão e ao motor de elegibilidade; sem declaração de PASS global ou autorização de merge/release. O utilizador autorizou explicitamente a execução pela secretaria e a auditoria no pedido atual.

## Resultado

Os botões tinham operações reais, mas o conjunto não completava a resolução: a secretaria era recusada nas decisões excecionais; validar exame não publicava a sessão; a reavaliação TypeScript podia voltar a usar nota antiga; auditoria de decisões antigas podia falhar após a gravação. Corrigidos no código e na migration complementar `20271105002000_balcao_secretaria_actions_audit.sql`.

| Ação | Efeito real e condição para remover o seu bloqueio |
|---|---|
| Autorizar correção por 24h | Cria exceção para operador, ano, turma, disciplina e trimestre; abre o formulário canónico. A autorização não muda a nota. O resultado precisa ser corrigido e aprovado pelas regras vigentes. |
| Abrir sessão de exame | Cria sessão e componentes atomicamente; ainda não altera elegibilidade. |
| Lançar e validar resultado | Guarda nota imutável e valida o componente. Componente isolado não publica o exame. |
| Encerrar e publicar exame | Recusa componentes incompletos ou participantes com resultados não validados; encerra a sessão e permite ao resolvedor consumir o exame. No teste, bloqueada → elegível. |
| Publicar/republicar pauta | Gera PDF, exige objeto válido e confirma publicação persistida; preserva versão anterior. Não corrige nota nem encerra exame. |
| Registar/retificar EJA | Evidência oficial versionada, com ata/fonte e motivo; só libera se todas as avaliações forem suficientes e a frequência oficial anual satisfizer a regra. Dados incompletos continuam pendentes. |
| Justificar falta | Aprovação só retira a falta vinculada; no teste, quatro faltas bloqueiam e a justificação aprovada reduz para três, removendo esse bloqueio. |
| Rever indisciplina | A decisão fundamentada resolve/cancela o evento; no teste, remove apenas o bloqueio disciplinar. |
| Deferir reapreciação | Regista decisão com motivo, autor e prazo; não inventa nota nem publica exame. |

Os três papéis de secretaria (`secretaria`, `admin_secretaria`, `secretaria_financeiro`) foram alinhados nas permissões de interface, API e operações SQL. Não foram ampliadas permissões estruturais de currículo. Políticas de imutabilidade e isolamento por escola permanecem aplicadas. Um helper restrito faz o bloqueio da sessão para conciliar publicação e escrita de resultados sem conceder gestão direta de sessões aos lançadores.

O resolvedor numérico passa a avaliar a fórmula instalada do boletim para a matrícula/disciplina consultada, sem esperar refresh da MV. A fonte do exame publicado, os bloqueios por faltas e os eventos disciplinares são considerados pela decisão SQL e pela reavaliação do Balcão. Erros ao consultar currículo, resultados ou faltas não são tratados como aprovação.

## Auditoria

Operações novas têm motivo, ator autenticado, escola, matrícula, chave de repetição e estado académico antes/depois. Decisões antigas de exame, reapreciação, indisciplina e justificação têm trigger transacional com campos anteriores/novos. Falha ao inserir auditoria aborta a alteração; isso foi provocado e verificado. O lançador canónico `lancar_notas_batch` já contém auditoria transacional e conserva os seus guards de escola, ano, período e escala.

## Evidência executada

- PostgreSQL 17 local, banco descartável e UUIDs sintéticos. Migration original e complementar instaladas; permissões reais de sessões, componentes e resultados usadas nas fixtures.
- Reprodução antes das correções: `BASELINE_SECRETARIA_DENIED_CONFIRMED` e `BASELINE_VALIDATION_WITHOUT_RELEASE_CONFIRMED`.
- `audit_effects.sql`: `BALCAO_ACTIONS_EFFECT_AND_SECRETARIA_PASS`; exerce exceção por operador, fórmula com MV desatualizada, publicação incompleta recusada, publicação completa, repetição idempotente, bloqueio de componentes após publicação, EJA, revisão disciplinar, justificação de faltas, falha deliberada de auditoria e isolamento de outra escola.
- `balcao-actions-ui-postgres.integration.ts`: 1 integração aprovada; dispara eventos reais nos formulários React, roda operações SQL como secretaria, invoca o adaptador TypeScript e classificador reais, comprova elegibilidade antes/depois, gera PDF real e confere a auditoria.
- 133 testes unitários/de regressão aprovados. Verificação de tipos completa aprovada. Lint dos ficheiros de produção alterados: zero erros, 14 avisos; o limite de zero avisos não passou. Pendência registada abaixo.

A integração usa DOM simulado e transporte, identidade e Storage explícitos de teste. A renderização do PDF é real, mas o seu conteúdo de entrada é sintético e não testa o builder com dados de produção. O botão de correção foi verificado até a abertura do formulário e o efeito da fórmula foi testado separadamente; não foi exercido o lançamento completo de notas pelo formulário/HTTP autenticado. Estas provas não equivalem a navegador autenticado, Next HTTP real ou Supabase hospedado.

## Tickets de validação pendentes

- **AUT006-HOSTED** — responsável: Engenharia; prazo: antes de release. Aplicar ambas as migrations num ambiente equivalente ao real; testar login da secretaria, lançamento de notas/exame, builders/Storage reais e ciclo pagamento já recebido → resolução académica → rematrícula concluída → recibo. Executar o workflow no GitHub e correlacionar commit e deployment. Nenhuma migration remota ou deploy foi realizado neste trabalho.
- **AUT006-LINT** — responsável: Engenharia; prazo: antes do gate global. Rever os 14 avisos dos ficheiros alcançados, incluindo tipos `any` legados e dependências de hooks. Não há erro de lint ou tipos neste escopo, mas o comando com `--max-warnings=0` não aprovou.

O banco de testes não reproduz o histórico completo de produção. O contrato de reabertura de matrícula ou ano com fecho legal continua fora da exceção de período. Elegibilidade académica não conclui automaticamente a rematrícula nem elimina outras pendências financeiras/administrativas.

## Repetir as provas

Num PostgreSQL **local e descartável**, banco vazio `balcao_*`:

```sh
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/audit_fixture.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20271105002000_balcao_secretaria_actions_audit.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/audit_effects.sql
```

Em `apps/web`, com JSDOM 26.1.0 temporário e dependências do workspace instaladas:

```sh
TEST_JSDOM_MODULE=/caminho/node_modules/jsdom/lib/api.js node --test --import tsx tests/balcao-actions-ui-postgres.integration.ts
```

O workflow `balcao-academic-operations.yml` executa estas provas num PostgreSQL descartável. A execução no GitHub ainda está pendente.

## Findings da versão anterior

# Auditoria dirigida — botões do Balcão (antes das correções)

Escopo: UI → API → SQL → elegibilidade, no commit a9f2573fd. Não é um PASS/FAIL global do repositório.

As regras AUT006 deste relatório são critérios funcionais do pedido atual: permissão de secretaria, resultado oficial consumível pelo RAA, mesma fonte na reavaliação e auditoria atómica.

```
FINDING
  id: AUT006-AUTH-c58e3724
  regra: AUT006-AUTH
  severidade: HIGH
  status: FAIL
  ficheiro: apps/web/src/lib/rematricula/balcao-academic-operation.ts
  linha: 17
  evidencia: "export const BALCAO_ACADEMIC_MANAGER_ROLES = [\"admin\", \"admin_escola\", \"diretor\"] as const;\nexport function canManageBalcaoAcademic(role: unknown) {\n  return BALCAO_ACADEMIC_MANAGER_ROLES.some((allowed) => role === allowed);"
  impacto: A secretaria não consegue executar nenhuma operação excecional.
  recomendacao: Autorizar os papéis de secretaria na interface, API e PostgreSQL.
  bloqueante: true
  excecao: null
```

```
FINDING
  id: AUT006-EXAM-89fbbb96
  regra: AUT006-EXAM
  severidade: HIGH
  status: FAIL
  ficheiro: supabase/migrations/20271105001000_balcao_academic_resolution.sql
  linha: 205
  evidencia: "   UPDATE public.exame_resultados SET estado='validado',updated_at=now()\n     WHERE id=exam_row.id AND escola_id=p_escola_id;\n   entity:=exam_row.id;"
  impacto: Validar uma nota não publica a sessão; o resolvedor só consome sessões publicadas ou encerradas.
  recomendacao: Adicionar publicação transacional da sessão após validar todos os componentes.
  bloqueante: true
  excecao: null
```

```
FINDING
  id: AUT006-SSOT-84c0045e
  regra: AUT006-SSOT
  severidade: HIGH
  status: FAIL
  ficheiro: apps/web/src/lib/academico/raa-progression-server.ts
  linha: 248
  evidencia: "      notaFinal: row?.nota_final == null ? null : Number(row.nota_final),\n      area: catalog?.area ?? null,\n      especifica: String(link?.classificacao ?? \"\") === \"especifica\" || String(catalog?.area ?? \"\").toLowerCase().includes(\"especific\"),"
  impacto: O adaptador pode ignorar um exame publicado ao reclassificar com a nota antiga da vista de boletim.
  recomendacao: Ler os resultados canónicos por disciplina na reavaliação.
  bloqueante: true
  excecao: null
```

```
FINDING
  id: AUT006-AUDIT-8ded84b3
  regra: AUT006-AUDIT
  severidade: HIGH
  status: FAIL
  ficheiro: apps/web/src/lib/audit.ts
  linha: 50
  evidencia: "  } catch (err: unknown) {\n    const message = err instanceof Error ? err.message : String(err);\n    console.error(\"recordAuditServer exception:\", message);"
  impacto: Uma falha do registo de auditoria pode ser ignorada após uma decisão operacional persistida.
  recomendacao: Garantir auditoria transacional nas tabelas alteradas pelos botões RAA.
  bloqueante: true
  excecao: null
```
