# CC-008, CC-010 e CC-013 — decisões conservadoras por escola

**Situação:** configuração e testes incluídos na PR desta fase. Nada aplicado em produção. CC-001/replay histórico pertence exclusivamente ao proprietário e **não é alterado**.

## CC-008 · Documentos e matrícula incompleta

Não existe uma relação canónica comprovada entre *tipo de aluno* e um catálogo de documentos obrigatórios por classe/ano. Implementámos `resolveAcademicRule()` com configuração privada `KLASSE_CC_ACADEMIC_RULES_JSON`, **falha fechada**, e uma explicação visível no filtro desactivado.

O formato de configuração é escola → classe (UUID) → *tipo de aluno aprovado* → `requiredDocumentCodes`, `incompleteEnrollmentStatuses`, `approved: true`. Não há fallback entre escolas/classes/tipos; arrays vazios, duplicações, desconhecidos e JSON inválido não activam filtros.

**Pergunta exacta para o proprietário:** "Que códigos de documentos são obrigatórios por escola, classe e tipo de aluno, e quais são os estados académicos oficiais que definem matrícula incompleta (incluindo rematrícula condicional, recurso e extraordinária)? Qual é o campo canónico que identifica o tipo de aluno em cada matrícula?"

**Gate de activação:** é necessário validar a taxonomia e o campo canónico de tipo de aluno na base, associar a leitura a ano/matrícula sob RLS e depois habilitar o filtro. **Não** considerar a ausência de sinalização `DOCUMENTOS_PENDENTES` como prova de documentos completos.

## CC-010 · Pendência financeira

A fonte já existente do motor financeiro para o saldo é `coalesce(valor_previsto,valor,0) - coalesce(valor_pago_total,0)`. O vínculo de mensalidade foi explicitamente reforçado com a **matrícula exacta** e o **ano letivo da matrícula**; nenhuma obrigação legada com `matricula_id IS NULL` é atribuída por heurística à matrícula corrente. O desempate da matrícula usa a sequência que o trigger financeiro já usa: `data_inicio_financeiro`, `data_matricula`, `created_at` e finalmente UUID. Vencimento calculado no dia civil de Luanda.

Uma prova **rejeitada**, **reenviada** ou **aprovada pela Secretaria** não liquida o saldo. Só os valores confirmados e persistidos em `valor_pago_total` alteram o saldo. Estados cancelados, isentos e pagos não produzem pendência mesmo que o valor previsto esteja desfasado.

**Pergunta exacta:** "Para mensalidades antigas sem `matricula_id` ou com vínculo inconsistente, qual é o processo autorizado de reconciliação financeira? Devem ficar fora da lista operacional até correcção, ou devem surgir numa fila separada de inconsistências?" **Decisão técnica conservadora:** excluir, não corrigir silenciosamente, não reatribuir matrículas.

Os testes sintéticos abrangem pagamento parcial, comprovativo rejeitado/reenviado/aprovado sem liquidação, ano anterior, duas matrículas e obrigação sem matrícula. As APIs, triggers, guardas fiscais e políticas RLS existentes ficam inalterados.

## CC-013 · Exportação

**OFF por omissão.** `KLASSE_CC_ROSTER_EXPORT_POLICY_JSON` é uma allowlist privada de política por UUID da escola. Cada entrada explicitamente aprovada necessita:

```json
{
  "00000000-0000-4000-8000-0000000000a1": {
    "enabled": true,
    "maxRows": 50,
    "roles": ["secretaria"],
    "purposeCode": "finalidade_aprovada_pela_escola",
    "retentionDays": 14
  }
}
```

**Atenção:** isto é um exemplo sintético de *formato*, **não uma autorização** ou configuração proposta para produção. O código recusa finalidade vazia, perfil estranho, mais de 200 linhas e retenção fora de 1–30 dias. O prazo máximo de 30 dias vem do job institucional de auditoria já instalado. A nova migration incorpora limpeza mais precoce exclusiva dos logs de exportação cujo `retention_until` venceu, sem alterar o job institucional.

Por exportação: confirmação de finalidade antes de solicitar; apenas nome/processo/turma; escape de fórmulas; consulta e contagem filtradas antes da página; registo do actor/escola/escopo/quantidade/filtro/ordenação/finalidade/`retention_until` (sem termos de pesquisa nem alunos); erro na auditoria **nega** o ficheiro. Códigos de ordenação são neutros (`A_Z`, `Z_A`, `PENDING_FIRST`).

**Pergunta exacta:** "Em cada escola, que perfis podem exportar listas de Turma e Classe, com que finalidade legítima, quantas linhas por exportação e qual prazo de retenção da auditoria (entre 1 e 30 dias)? Deve a impressão existir além do CSV?" Até decisão explícita, `enabled=false`.

## Testes e execução controlada

O workflow do PostgreSQL 17 descartável aplica e reaplica a migration aditiva, verifica recusa na função de limpeza para `authenticated`, apaga apenas o audit vencido, preserva auditorias de outra finalidade, reverte o aditivo, confirma a reversão e reaplica. A fixture é sintética e **não** comprova o replay completo das migrations de produção (CC-001 paralelo).

Comandos de inspecção (somente em base descartável, nunca Supabase ligado):

```bash
psql "$CC_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/ops/tests/regression_command_center_finance_scope.sql
pnpm -C apps/web exec tsx --test tests/unit/command-center-school-policies.spec.ts
```

Revisão humana e aplicação de migrations estão sujeitas a autorização separada. Não executar `supabase db push` nem deploy desta fase.
