# KLASSE — Status de implementação dos fluxos de Secretaria

Data: **2026-08-10**  
Escola de validação: **Complexo Escolar Privado Adventista de Curtume**

## Resumo

Os fluxos críticos de atendimento, rematrícula, cobrança e consulta académica foram alinhados para trabalhar com contexto de escola e ano letivo. O principal fluxo quebrado — pagamento confirmado com matrícula pendente — agora possui estado explícito, fila de reconciliação e ação administrativa dedicada.

## Rematrícula e reconciliação

Fluxo esperado:

```text
Pesquisar aluno
→ seleccionar ano letivo
→ validar matrícula, turma, preço e dívidas
→ cobrar a taxa de rematrícula
→ confirmar/reconfirmar matrícula
→ emitir comprovante
→ reconciliar exceções sem cobrar novamente
```

Implementado:

- status de elegibilidade e operação unitária;
- idempotência e prevenção de pagamento duplicado;
- auditoria da operação;
- estados `READY`, `DEBT_BLOCKED`, `PRICE_NOT_CONFIGURED`, `ALREADY_COMPLETED`, `PAYMENT_IN_PROGRESS`, `LEGACY_REVIEW_REQUIRED` e `RECONCILIATION_REQUIRED`;
- fila dedicada em `/secretaria/rematricula/reconciliacao`;
- acesso nos perfis `admin`, `admin_financeiro`, `financeiro` e `secretaria`;
- CTA no Balcão e navegação lateral com badge `Resolver`.

## Balcão de cobrança

Implementado:

- selector de ano letivo no atendimento;
- resolução automática do ano ativo quando a URL não possui `ano_letivo_id`;
- propagação do contexto ao dossier, mensalidades, rematrícula e pagamento;
- troca de aluno sem fechar o balcão;
- limpeza do carrinho ao trocar de aluno;
- pagamento em numerário com total pré-preenchido e cálculo de troco;
- ordenação cronológica por ano e mês, evitando que Janeiro/2027 preceda Setembro/2026.

## Lista de turmas e alunos

Na tela de detalhe da turma:

- pesquisa por nome, BI ou número de matrícula;
- filtro financeiro por `Todos`, `Em dia` e `Em atraso`;
- mensagem de estado vazio contextual;
- nome do aluno clicável;
- ação explícita `Perfil`;
- inclusão de matrículas transferidas/concluídas no histórico da turma.

Na lista financeira de turmas:

- pesquisa por turma, aluno e identificador;
- filtro de inadimplentes;
- perfil completo e extrato financeiro;
- contagem da turma alinhada aos status históricos válidos.

## Histórico transitado

Backend aplicado:

- `public.historico_transitado_anos`;
- `public.historico_transitado_notas`;
- índices de escola/aluno e histórico/notas;
- RLS para staff da escola e super-admin;
- RPC `upsert_historico_transitado(...)`;
- compatibilidade com `historico_anos` e `historico_disciplinas`.

Migração aplicada:

O Histórico Transitado agora referencia `anos_letivos.id` como contexto académico canónico. O inteiro `ano_letivo` permanece apenas como coluna de compatibilidade para RPCs legadas, sincronizada automaticamente pela base de dados. Para o contexto angolano, a interface apresenta o intervalo académico real:

```text
ano_letivo_id → anos_letivos.id
label → data_inicio/data_fim → 2025/2026
```

O perfil do aluno deixou de apresentar `Ano civil` e passou a usar o seletor `Ano letivo`, com o intervalo académico oficial.

## Validações realizadas

- TypeScript do frontend: PASS nas últimas alterações.
- ESLint direcionado: sem erros; warnings legados permanecem documentados pelo próprio lint.
- `git diff --check`: PASS nos arquivos alterados.
- PostgreSQL: tabelas, RLS, índices e RPC do histórico transitado confirmados.
- PostgreSQL: anos letivos do Curtume confirmados como intervalos, incluindo `2026-09-01 → 2027-08-31`.
- PostgreSQL: `historico_transitado_anos.ano_letivo_id` criado como FK para `anos_letivos.id`, sem registos órfãos no momento da migração.

## Próximos passos

1. Exibir labels `2025/2026`, `2026/2027`, `2027/2028` nas restantes telas académicas ainda baseadas em ano civil.
2. Executar E2E autenticado por perfil e por ano letivo.
3. Testar concorrência de dois atendentes no mesmo aluno/pagamento.
