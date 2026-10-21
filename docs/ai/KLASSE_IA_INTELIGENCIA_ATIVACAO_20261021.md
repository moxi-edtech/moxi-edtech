# KLASSE IA — ativação e decisões pendentes

## Ativação segura

Cada intenção tem três chaves de ambiente independentes: `KLASSE_AI_<NOME>=true`, `KLASSE_AI_<NOME>_SOURCE_PROVEN=true`, `KLASSE_AI_<NOME>_ISOLATION_PROVEN=true`. **Todas desligadas por padrão**; uma flag isolada não ativa consultas. As duas provas devem ser atestadas por CI de Postgres/Auth/RLS antes de configurar o ambiente. O código falha fechado com recusa explícita. Não foram aplicadas migrations nem alterações de RLS ou permissões.

| Intenção | Flag (`KLASSE_AI_` +) | Estado | Evidência que falta |
|---|---|---|---|
| Docentes com notas em atraso | `TEACHER_GRADE_DEADLINES` | Recusa fundamentada | Avaliações previstas, atribuições encerradas, RLS real/polo |
| Lista de docentes/turmas | `TEACHER_PENDING_DETAILS` | Recusa fundamentada | Mesma prova + acesso nominal por papel |
| Alunos sem notas na disciplina | `STUDENTS_WITHOUT_SUBJECT_GRADES` | Recusa fundamentada | Alunos distintos, por instrumento e trimestre |
| Faltas mensais | `MONTHLY_ABSENCES` | Recusa fundamentada | Read-model canónico mensal + polo |
| Matrículas incompletas | `PENDING_ENROLLMENTS` | Bloqueada por decisão de negócio | Configuração escolar de estados incompletos |
| Vagas por turma | `AVAILABLE_CLASS_SEATS` | Recusa fundamentada | E2E com RLS real, duas escolas e dois polos |
| Previsto vs. recebido | `MONTHLY_FINANCE` | Recusa fundamentada | Contrato de liquidação, isolamento financeiro por polo |
| Mensalidades vencidas | `AGED_TUITIONS` | Recusa fundamentada | Vencimento individual, liquidação, RLS/polo |
| Documentos em falta | `MISSING_DOCUMENTS` | Bloqueada por decisão de negócio | Obrigatoriedade por classe/tipo de aluno |
| Risco oficial de reprovação | `OFFICIAL_FAILURE_RISK` | Bloqueada por decisão de negócio | Critério oficial RAA aplicável a cada escola |

**Ativas:** nenhuma. A recusa é deliberada até à prova integral; CI unitário não substitui teste autenticado de Postgres/RLS. O catálogo não consulta dados reais quando desligado.

## Denominador de professores

`turma_disciplinas_professores` é a fonte canónica de atribuições professor/turma/disciplina. A consulta foi acrescentada à ferramenta de notas: `denominator` é a contagem de `professor_id` distintos na atribuição, não a contagem de linhas da MV. Uma atribuição sem avaliação correspondente ou uma avaliação sem atribuição atual bloqueia a resposta. A tabela não tem data de fim da atribuição nem a definição de avaliação prevista por trimestre; logo, a igualdade de conjuntos **não prova** que a atribuição esteve ativa no período. Não autorizar ativação até esse vínculo temporal ser validado. Testes sintéticos cobrem duplicação em várias turmas e mismatch; falta prova de atribuição encerrada com dados reais de contrato (sem PII).

## Perguntas exatas que exigem decisão

1. **Matrícula incompleta:** «Quais estados do fluxo de matrícula contam como *pendente de conclusão* na sua escola, e a partir de que evento deixam de contar?»
2. **Documento obrigatório:** «Para cada classe e tipo de aluno (novo, transferido, rematriculado), quais documentos são obrigatórios e em que prazo?»
3. **Risco de reprovação:** «Qual resolução oficial RAA, versão e limiares aprovados pela escola determinam a classificação por turma e em que fase do ano letivo?»

Estas definições devem ser guardadas por escola em configuração validada, com ausência = recusa. Não foi introduzido padrão de negócio inventado nem alteração do resolvedor académico.

## Isolamento e validação ainda bloqueados

O snapshot de `escola_users` não contém `polo_id`, e as views de notas e turmas não expõem vínculo canónico polo↔turma. Não inferir por nome ou escola. Secretaria e outras funções de polo ficam recusadas; admin/direção só podem receber resultados após prova RLS. Não há CI E2E com todas as migrations e usuários de polos distintos; a infraestrutura de testes não comprova que toda a cadeia histórica de migrations seja reaplicável. Antes de ativar, criar e validar esse cenário com Postgres descartável e políticas existentes, sem modificar RLS em produção.

## Gates

- Criar read-models e configurações por escola **após aprovação das definições**, em migrations novas, com aplicar/reaplicar/reverter e EXPLAIN medido no CI; sem aplicar em produção.
- Provar RLS Auth com secretaria/direção A e B, polos X/Y e admin, consultas diretas/RPC e tentativas de prompt injection em todas as ferramentas a ativar.
- Ativar individualmente somente depois da evidência de fonte e isolamento, anexando relatórios de testes e capturas sintéticas no PR.
- Nenhum merge ou deploy autorizado.
