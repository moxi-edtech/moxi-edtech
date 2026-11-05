# Operações académicas no Balcão — implementação local

Base: merge #320 (`89cdaca62`). Branch: `codex/balcao-resolucao-excecional`.
Aprovação: `APPROVE: f6bf391c-3b44-4d47-8d06-eaf3e996cea3`, fornecida pelo utilizador e registada no commit `600c303c5`.

## Comportamento

Na ficha Rematrícula, «Resolver operação académica aqui» abre formulários de sessão de exame, validação de resultados submetidos, exceção temporária de notas, publicação/republicação de pauta e avaliação qualitativa EJA. Confirmação mostra os dados e o alcance da operação, incluindo quando afeta toda a turma.

A secretaria e a direção/administração académica confirmam com fundamento; a autorização é revalidada no servidor e no PostgreSQL pelo vínculo atual de escola. Papéis autorizados: admin, admin_escola, diretor, secretaria, admin_secretaria e secretaria_financeiro. Professor não recebe permissão de decisão excecional. A correção de notas usa a exceção existente por utilizador, turma, disciplina, trimestre e ano, durante 24h, com acesso ao formulário canónico no mesmo atendimento.

As novas escritas são transacionais e idempotentes, com auditoria. Retificação EJA acrescenta evidência e exige a versão anterior esperada. Sessão e componentes são criados juntos. A validação de exame preserva a nota submetida. A ação separada de encerrar e publicar exige todos os componentes dos participantes validados; só então a sessão fica encerrada e o resultado passa a ser consumido pelo RAA.

Pautas usam os builders e o Storage existentes, com reserva de publicação, token por tentativa e caminho novo para cada versão. Confirmação de sucesso exige o objeto PDF no Storage e a transição oficial persistida. O PDF anterior fica referenciado na auditoria e uma tentativa falhada preserva a última publicação válida. Tentativas concorrentes recebem estado de processamento; reserva interrompida pode ser recuperada após 15 minutos. O workflow de teste usa um fixture de Storage, não o serviço real.

A avaliação EJA qualitativa é consumida pelo resolvedor SQL e pelo adaptador TypeScript. A pauta anual usa S/NS; não há conversão de números em classificação qualitativa. A frequência vem das presenças oficiais dos três períodos da matrícula de origem. Falta de evidência ou de frequência completa produz pendência, sem aprovação presumida.

Após guardar, o painel reconsulta a rematrícula e mantém a ficha e o pagamento existente. Falha de revalidação não é apresentada como falha da gravação. O operador pode repetir só a verificação; a próxima ação e a reconciliação de pedidos pagos continuam nos fluxos canónicos. Não foi criada outra cobrança nem conclusão automática por decisão de interface.

## Limites explícitos

- A exceção é de **período**, com matrícula e ano ativos. Não reativa matrículas concluídas, anuladas ou transferidas e não reabre globalmente um ano encerrado. Uma reabertura de fecho legal exige um contrato próprio; não foi implementado um bypass desses estados.
- A pauta EJA integrada é anual. Avaliação qualitativa trimestral e apresentação completa nos portais de aluno/professor não foram homologadas.
- O CI adicionado ainda não foi executado no GitHub. Testes locais não demonstram uma sessão real no Balcão nem o ciclo pagamento → rematrícula → recibo.
- Migration apenas versionada. Nenhum banco remoto foi alterado; sem merge ou deploy deste trabalho.

## Evidência de validação local

- 132 testes Node: contratos académicos, EJA, rematrícula paga e operações novas.
- PostgreSQL 17 descartável: migration instalada desde zero sobre fixture explícito; isolamento de duas escolas, restrições da migration original, antes da autorização complementar à secretaria, retificação obsoleta, idempotência, sessão sem órfãos, validação de exame, exceção expirada, fecho legal, publicação sem PDF, token obsoleto, recuperação e preservação de versão anterior.
- Duas sessões PostgreSQL simultâneas: uma única evidência, operação e auditoria para a mesma chave.
- Verificação de tipos do projeto web.

O fixture inclui os triggers reais de exame e os resolvedores existentes, mas não reproduz todo o schema/histórico de migrations de produção. Não substitui homologação em ambiente equivalente ao real.

## Como repetir

Usar **apenas PostgreSQL descartável**, num banco vazio de nome `balcao_*`:

```sh
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/fixture.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/regression.sql
PGURL="$PGURL" python3 supabase/ops/tests/balcao_academic_resolution/concurrency.py
```

Em `apps/web`:

```sh
node --test --import tsx tests/unit/balcao-academic-operation.spec.ts tests/unit/raa-*.spec.ts tests/unit/aut004-paid-academic-dual-axis.spec.ts tests/unit/aut004-aut012-operational-contract.spec.ts
pnpm exec tsc --noEmit --incremental false
```

## Performance e próximos passos

Metas, ainda não medidas: feedback local <50ms, consulta contextual p95 ≤500ms, primeira apresentação de pauta <300ms com skeleton. A geração do PDF tem indicador de progresso e reserva, sem prometer esse SLA para a emissão completa. Leituras operacionais usam no-store; listas têm limite de 50, pautas percorrem páginas e a carga de decisões EJA tem concorrência máxima de 5.

1. Rever o diff e executar o workflow do GitHub.
2. Aplicar a migration num ambiente de homologação equivalente ao real e executar o Balcão autenticado por papel, com fixtures seguras, incluindo pedido já pago.
3. Publicar a aplicação somente após esses testes e autorização de release.

A auditoria e as provas após a autorização complementar estão em [auditoria dos botões](auditoria-balcao-secretaria-20261105.md).

O percurso foi completado com lançamento guiado de componentes e frequência EJA no próprio atendimento. Ver [experiência guiada e provas](balcao-experiencia-guiada-20261105.md).
