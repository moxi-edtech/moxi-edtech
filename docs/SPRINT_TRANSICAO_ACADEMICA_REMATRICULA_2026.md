# Sprint — Transição académica e rematrícula 2026

**Data:** 2026-08-22

**Última atualização:** 2026-08-23

**Duração:** 5 dias úteis

**Prioridade:** P0 — operação académica e financeira

**Problema:** alunos que concluíram 2025 ficam como `pendente`/inativos, desaparecem da turma e não conseguem iniciar a rematrícula em 2026.

**Contrato de referência:** [CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md](./CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md)

## Exceção de produto — Curtume: virada assistida

O Curtume começou a usar o KLASSE no meio de 2025 e não lançou todas as notas,
frequências e dados letivos. Para esta escola, notas ausentes não significam
reprovação e não devem impedir a decisão de balcão.

O produto passa a suportar uma decisão administrativa individual, com auditoria:

- `aprovado`: encaminha para a classe seguinte;
- `reprovado`: encaminha para a mesma classe;
- `concluído`: encerra o ciclo sem criar destino quando aplicável;
- `revisão necessária`: não cria nem ativa destino.

Toda decisão sem notas completas deve guardar `fonte =
declaracao_administrativa_escola`, motivo, utilizador, data e observação. O
KLASSE não inventa notas nem altera pautas retroativamente. A secretaria pode
lançar o histórico depois, sem apagar a decisão ou a auditoria da virada.

O atendimento canónico é: matrícula histórica 2025 → decisão administrativa →
turma destino → reserva 2026/2027 → dívida/acordo → ativação final. Todas as
etapas permanecem no mesmo contexto do Balcão.

### Confronto com o código existente — 23 de agosto de 2026

| Parte da proposta | Evidência no código | Estado |
|---|---|---|
| Notas ausentes não são reprovação automática | `RematriculaBalcaoModal.tsx` permite decidir o resultado no próprio balcão e marcar “Lançar notas depois” | IMPLEMENTADO |
| Confirmação obrigatória da secretaria | `POST /api/secretaria/balcao/rematriculas` rejeita sem `notas_lancar_depois` quando há notas pendentes | IMPLEMENTADO |
| Autorização humana com pendências | RPC `autorizar_promocao_com_pendencias` e tabela `promocoes_com_pendencias` | IMPLEMENTADO |
| Motivo e actor auditáveis | RPC grava `motivo`, `autorizado_por`, `autorizado_em` e `audit_logs` | IMPLEMENTADO |
| Progressão e retenção | `resolve_raa_progression_for_matricula` e validação de classe destino na rota | IMPLEMENTADO |
| Reserva antes da ativação | `preparar_aluno_para_rematricula`/`finalizar_rematricula_balcao` | IMPLEMENTADO |
| Dívida separada da decisão académica | modal e rota mostram dívida e bloqueiam somente a etapa financeira | IMPLEMENTADO |
| Proveniência explícita `declaracao_administrativa_escola` | Modal recolhe fonte/motivo/observação; rota e RPC persistem o registo auditável | IMPLEMENTADO |
| Estado persistido `revisão necessária` | Não existe decisão operacional equivalente; hoje a API devolve `409` até a secretaria marcar “notas depois” | NÃO IMPLEMENTADO |
| Modo/flag específico Curtume | O fluxo é genérico; não há cohort, feature flag ou fila própria da escola | NÃO IMPLEMENTADO |
| Observação livre da secretaria | Modal envia `decisao_observacao` e a RPC guarda a observação na decisão de origem | IMPLEMENTADO |

Conclusão: não devemos reescrever o fluxo. A seleção de turma, a reserva, a
dívida, a auditoria e a opção “lançar notas depois” são reutilizadas no mesmo
modal. Continua pendente uma fila/estado explícito para `revisão necessária`.

### Modelo de dados confirmado

No schema atual, `matriculas.status` não é o campo do resultado académico e não
aceita `reprovado` como estado canónico. O resultado é guardado em
`historico_anos.resultado_final`; a matrícula de origem deve terminar como
`status = 'concluido'`, `ativo = false`, mantendo o resultado no histórico.

`transferido` não deve ser usado para representar a progressão anual da Curtume.
O seu uso fica reservado a transferência escolar ou reconciliação de um destino
já criado. A alteração das RPCs de finalização está preparada para aprovação em
`agents/outputs/PENDING_APPROVAL_CURTUME_ORIGEM_RESULTADO_20260823.md`.

## Implementação desta iteração

Nesta secção, `[x]` significa **implementado e validado no working tree**. A
migration `20270823200000_preserve_rematricula_academic_result` já foi aplicada
no ambiente remoto; a validação integrada com dados reais continua aberta.

- [x] Portal resolve matrícula histórica `concluido`/`reprovado` como origem.
- [x] Portal deixa de exigir matrícula ativa já criada no ano destino.
- [x] Portal valida a decisão RAA antes de iniciar a rematrícula.
- [x] Disciplinas pendentes e recursos são devolvidos como pendência académica,
  sem alterar o estado financeiro.
- [x] Migrations preparadas para alinhar as RPCs de início/confirmação a origem histórica,
  validar RAA no banco e limitar a dívida à matrícula/ano de origem.
- [x] Migrations preparadas para alinhar a autorização das RPCs ao portal, aceitando o próprio aluno
  ou encarregado formalmente vinculado.
- [x] Rotas resolvem explicitamente a escola do utilizador e usam respostas sem
  cache para estado académico/financeiro operacional.
- [x] Reserva académica passou a aceitar promoção e retenção decididas pelo
  RAA, sem usar dívida para alterar ou esconder o destino.
- [x] Migrations preparadas para a confirmação de balcão e rematrícula em massa validarem no banco:
  RAA, inscrição condicional bloqueada, turma sequencial, capacidade e dívida
  limitada à matrícula/ano de origem.
- [x] Cockpit da virada reorganizado numa jornada única de seis etapas, sem o
  operador sair do contexto da transição académica.
- [x] Simulação do cockpit deixa alunos com dívida entrarem na reserva e mostra
  a dívida apenas como pendência para a ativação final.
- [x] Portal resolve a taxa pela classe/curso destino, com a mesma prioridade
  de preços usada pelo balcão.
- [x] Migration preparada para congelar classe, curso, tabela, origem do preço
  e valor no pedido e na intenção de pagamento.
- [x] Banner apresenta classe destino e taxa antes do pagamento e atualiza o
  estado quando o aluno regressa ao portal.
- [x] Fallback do modal da secretaria aceita matrículas históricas
  `concluido`/`reprovado` quando o contexto do pedido precisar ser recuperado.
- [x] Selecção múltipla de mensalidades e total pendente no portal do aluno.
- [x] Um único upload cria alocações contabilísticas ligadas por `lote_id`.
- [x] A secretaria agrega o comprovativo e decide o lote numa única transacção.
- [x] Aplicar a migration
  `20270823170000_pagamentos_comprovativo_consolidado.sql` no ambiente remoto,
  registada como `20270823170000`; migrations académicas anteriores continuam
  pendentes e devem ser aplicadas em sequência antes do deploy integral.
- [x] Testes de regressão adicionados para origem concluída/reprovada e exclusão
  de origem `pendente`.
- [ ] Corrigir o cálculo financeiro para considerar somente valores vencidos,
  excluindo cobranças futuras do bloqueio.
- [ ] Definir e implementar o efeito de acordo financeiro aprovado.
- [ ] Permitir completar notas, frequência e dados RAA dentro do cockpit, sem
  navegação para módulos externos.
- [x] Formalizar o modo Curtume de virada assistida, sem exigir notas completas
  para a decisão de balcão.
- [x] Implementar localmente a origem auditável `declaracao_administrativa_escola`
  e o fecho da matrícula de origem em `historico_anos`/`concluido`.
- [ ] Aplicar `20270823200000_preserve_rematricula_academic_result.sql` depois da
  cadeia académica remota pendente.
- [ ] Executar os 13 cenários obrigatórios em ambiente integrado.
- [ ] Aplicar as migrations no ambiente remoto após revisão/aprovação.

## Objetivo

Permitir que um aluno com matrícula histórica concluída possa:

1. ser avaliado academicamente;
2. receber uma turma destino para 2026;
3. ver eventuais propinas em atraso;
4. regularizar a situação financeira;
5. concluir a rematrícula com uma nova matrícula oficial em 2026.

A matrícula histórica de 2025 não deve ser reativada artificialmente.

## Princípios de negócio

- Matrícula de 2025 concluída permanece histórica e encerrada.
- A matrícula de 2026 só é oficializada após confirmação da rematrícula.
- Dívida financeira bloqueia a confirmação, mas não deve esconder o aluno.
- Promoção académica e pagamento são etapas diferentes.
- A turma destino deve ser definida antes da confirmação final.
- Toda alteração crítica deve gerar auditoria.

## Estado esperado do fluxo

```text
Matrícula 2025 concluída
        ↓
Avaliação académica / promoção
        ↓
Turma destino 2026 definida
        ↓
Verificação de propinas vencidas
        ↓
Regularização ou acordo aprovado
        ↓
Nova matrícula oficial em 2026
        ↓
Comprovativo e acesso académico
```

## Experiência operacional no cockpit

O cockpit deve ser a área dedicada da secretaria para concluir a virada sem
andar entre telas. A jornada canónica é:

1. completar notas, frequência e dados RAA de 2025;
2. calcular aprovação, retenção, recurso ou conclusão;
3. encerrar as matrículas de 2025;
4. gerar as reservas de 2026 em lote;
5. encaminhar aprovados para a classe seguinte e reprovados para a mesma classe;
6. ativar as matrículas finais, bloqueando apenas quem tiver propinas vencidas.

O working tree já torna as seis etapas explícitas e mantém a reserva separada
da ativação. A edição contextual de notas e frequência dentro do cockpit ainda
é uma pendência funcional.

## Confronto com o fluxo existente

O repositório já possui um fluxo de transição. Este sprint deve corrigi-lo e
completá-lo, sem criar uma segunda máquina de estados.

### Contratos existentes que permanecem como SSOT

| Responsabilidade | Contrato existente | Decisão do sprint |
|---|---|---|
| Ano letivo operacional | `anos_letivos.id` através de `session_id` | Reutilizar; não criar `ano_letivo_id` em `matriculas` |
| Estado textual | `canonicalize_matricula_status_text` | Reutilizar; `concluida`/`concluido` normalizam para `concluido` |
| Matrícula oficial ativa | `status = 'ativo'` e `ativo = true` | Usar somente após confirmação |
| Reserva de destino | `preparar_aluno_para_rematricula` | Reutilizar matrícula destino `pendente`, `ativo = false` |
| Confirmação final | `aluno_confirmar_rematricula`, `finalizar_rematricula_balcao`, `rematricula_em_massa` | Entradas distintas, com o mesmo contrato transacional de ativação |
| Rematrícula em lote | `rematricula_em_massa` | Reutilizar no lote da secretaria, sem contrato paralelo |
| Progressão académica | `resolve_raa_progression_for_matricula` | Única fonte para promoção/retenção |
| Relação origem/destino | `origem_transicao_matricula_id` | Preencher na matrícula destino |

### Inconsistências encontradas e estado atual

- **Corrigido no working tree:** `getAlunoContext` e o portal deixam de exigir
  matrícula ativa em 2026 para iniciar a rematrícula.
- **Corrigido no working tree:** o portal aceita origem histórica
  `concluido`/`reprovado`, conforme a decisão RAA.
- **Migration preparada:** `preparar_aluno_para_rematricula` cria a reserva
  antes da regularização; dívida não altera nem esconde o destino académico.
- **Migration preparada:** origem `pendente` deixa de ser tratada como concluída
  pelas RPCs de confirmação.
- `rematricula_em_massa` já aplica RAA, dívida e classe destino; não devemos
  duplicar essa regra no frontend ou numa nova RPC.
- **Decisão fechada:** `transferido` serve apenas para recuperar ou reconciliar
  uma transição que já possua destino vinculado; não representa conclusão nem
  deve ser criado numa nova virada.
- **Pendente:** o cálculo de dívida ainda precisa separar propina vencida de
  cobrança futura e formalizar a regra de acordo aprovado.

### Contrato único do sprint

```text
Origem 2025: concluido/reprovado, ativo = false
Pré-rematrícula 2026: status = pendente, ativo = false,
                      origem_transicao_matricula_id = origem
Rematrícula confirmada: destino = ativo/true; origem permanece histórica
```

Não serão criados estados como `promovido`, `aguardando_financeiro` ou
`pre_matriculado`, nem uma nova tabela de promoção.

## Escopo funcional

Nos checklists abaixo, `[x]` representa implementação ou decisão já refletida
no working tree; `[ ]` representa trabalho ainda pendente ou não validado de
ponta a ponta.

### 1. Modelo académico

- [x] Documentar os estados válidos de matrícula:
  - `pendente`
  - `ativo`
  - `concluida` ou `encerrada`
  - `reprovada`
  - `cancelada`
- [ ] Separar estado académico de estado operacional usando os campos e RPCs
  existentes.
- [x] Confirmar como a aplicação regista promoção, reprovação e conclusão.
- [x] Definir a regra padrão de progressão: 10.ª classe → 11.ª classe.
- [x] Definir exceção para aluno que repete a classe.
- [x] Cobrir disciplinas pendentes, recurso e inscrição condicional através do
  RAA, sem criar novos estados em `matriculas`.
- [x] Usar `resolve_raa_progression_for_matricula` como única fonte de decisão.

### 2. Elegibilidade no portal do aluno

- [x] Permitir matrícula anterior `concluido`/`reprovado` como origem, conforme
  a decisão RAA.
- [x] Não exigir matrícula ativa em 2026 antes da confirmação.
- [x] Remover o falso bloqueio `ACADEMIC_PROMOTION_PENDING` quando existir conclusão académica válida.
- [x] Exibir estados claros:
  - “Aguardando definição da turma”
  - “Existem propinas em atraso”
  - “Rematrícula disponível”
  - “Rematrícula concluída”
- [x] Garantir que o portal usa o mesmo ano letivo da secretaria.

### 3. Validação financeira

- [ ] Calcular apenas propinas vencidas associadas à matrícula/ano anterior.
- [ ] Diferenciar dívida vencida de valores futuros.
- [x] Bloquear a confirmação quando houver dívida da origem não regularizada.
- [ ] Permitir pagamento ou acordo aprovado conforme as regras financeiras da escola.
- [x] Não ativar matrícula oficial de 2026 antes da confirmação financeira;
  a reserva permanece `pendente`, `ativo = false`.
- [ ] Registar a decisão e a origem do pagamento/acordo.
- [x] Resolver a taxa de rematrícula pela classe/curso destino.
- [x] Congelar o preço e a sua origem no pedido de pagamento.

### 4. Secretaria e balcão

- [x] Mostrar alunos com matrícula histórica concluída na operação de rematrícula.
- [x] Não depender exclusivamente de `matriculas.ativo = true` para localizar a origem.
- [x] Sugerir a classe seguinte automaticamente.
- [x] Permitir selecionar a turma destino correta.
- [x] Mostrar claramente dívidas e bloqueios.
- [x] Manter portal, balcão e lote como entradas distintas para o mesmo contrato
  transacional de ativação da matrícula oficial de 2026.
- [x] Evitar duplicidade se já existir uma matrícula destino válida.

### 5. Dados da Escola KLASSE

- [ ] Auditar as cinco matrículas da turma `ENF-10ª Classe-M-A` de 2025.
- [ ] Confirmar para cada aluno:
  - resultado académico;
  - aprovação ou reprovação;
  - propinas vencidas;
  - turma destino 2026;
  - existência de pedido ou pagamento anterior.
- [ ] Corrigir o estado através de operação segura e auditada.
- [ ] Não executar atualização em massa sem validação individual.
- [ ] Confirmar que a turma destino de 2026 está configurada e possui currículo/disciplas.

## Escopo técnico provável

### Backend/API

- [x] Rever `apps/web/src/lib/alunoContext.ts`.
- [x] Rever `apps/web/src/app/api/aluno/rematricula/status/route.ts`.
- [x] Rever rotas de rematrícula da secretaria e do balcão.
- [x] Centralizar a resolução da matrícula de origem.
- [x] Reutilizar o contrato RAA e as RPCs existentes para promoção e turma
  destino; não criar contrato paralelo.
- [x] Garantir `force-dynamic` e `cache: 'no-store'` nas rotas transacionais.

### Base de dados

- [x] Inspecionar constraints e valores permitidos em `matriculas.status`.
- [x] Confirmar funções/RPCs de promoção e rematrícula.
- [x] Confirmar integridade entre `matriculas`, `turmas`, `classes` e `anos_letivos`.
- [x] Criar migration apenas se o modelo atual não suportar a correção do
  contrato existente.
- [x] Se necessário, ajustar a RPC/consulta existente; não criar coluna ou
  status paralelo.
- [x] Não alterar dados financeiros nem políticas RLS neste sprint sem aprovação explícita.

### Interface

- [x] Atualizar banner de rematrícula do aluno.
- [x] Atualizar cartão do balcão.
- [x] Mostrar motivo operacional e ação recomendada.
- [ ] Diferenciar “sem turma destino” de “com dívida”.
- [x] Exibir as seis etapas da virada numa única jornada contextual.
- [x] Mostrar no portal a classe destino e a taxa correspondente.
- [x] Atualizar a rematrícula ao regressar à aba após validação financeira.
- [x] Abrir o modal de turma destino na mesma janela de recebimento após a
  secretaria validar a taxa de rematrícula.
- [ ] Permitir correção contextual de notas e frequência dentro do cockpit.

## Critérios de aceitação

Os critérios permanecem abertos até validação integrada, aplicação das
migrations no ambiente alvo e conferência com dados reais autorizados.

- [ ] Aluno com matrícula 2025 concluída aparece na operação de rematrícula.
- [ ] Aluno aprovado é encaminhado para a classe seguinte.
- [ ] Aluno reprovado permanece elegível apenas para turma da mesma classe.
- [ ] Dívida vencida bloqueia a confirmação, mas não gera erro de promoção pendente.
- [ ] Aluno sem turma destino recebe mensagem operacional clara.
- [ ] A matrícula histórica de 2025 não é reativada artificialmente.
- [ ] A matrícula destino de 2026 só é ativada/oficializada após a confirmação
  exigida; a reserva pode existir antes.
- [ ] Não existem estados ou tabelas paralelas às RPCs e ao contrato canónico.
- [ ] Portal e secretaria exibem o mesmo estado.
- [ ] Não há matrícula 2026 duplicada.
- [ ] Todas as alterações críticas possuem auditoria.
- [ ] Portal e balcão apresentam exatamente o mesmo preço para a mesma classe.
- [ ] O preço permanece igual entre apresentação, pedido, comprovativo e
  conclusão da rematrícula.
- [ ] Após validar a taxa, a secretaria conclui turma e matrícula no modal sem
  pesquisar novamente o aluno.
- [ ] Um comprovativo de várias mensalidades aparece uma única vez na fila e
  nunca produz liquidação parcial do lote em caso de erro.
- [ ] Aluno Curtume sem notas pode ser decidido no Balcão sem ser classificado
  automaticamente como reprovado.
- [ ] Toda decisão administrativa sem notas exige motivo, utilizador, data e
  origem da decisão.
- [ ] A secretaria conclui decisão, turma, dívida e ativação sem perder o
  contexto do aluno.

## Casos de teste obrigatórios

1. Aluno aprovado, sem dívida e com turma destino.
2. Aluno aprovado, com dívida vencida.
3. Aluno aprovado, sem turma destino configurada.
4. Aluno reprovado.
5. Aluno com matrícula histórica `concluida`.
6. Aluno com matrícula histórica `pendente` que precisa de revisão.
7. Aluno com disciplina pendente elegível para inscrição condicional.
8. Aluno com disciplina em recurso.
9. Aluno com disciplinas acima do limite e retido na mesma classe.
10. Aluno já rematriculado em 2026.
11. Pedido de rematrícula pago, mas matrícula destino inexistente.
12. Duplo clique/reenvio da confirmação.
13. Acesso ao portal sem matrícula ativa no ano atual.

## Plano de execução

### Dia 1 — Diagnóstico e contrato

- Fechar a matriz de estados académicos e operacionais.
- Auditar migrations, RPCs e rotas atuais.
- Confirmar regra de progressão e regra financeira.
- Produzir checklist individual das cinco alunas afetadas.

### Dia 2 — Backend e elegibilidade

- Corrigir resolução da matrícula de origem para aceitar histórico concluído ou
  reprovado quando autorizado pelo RAA.
- Ajustar elegibilidade do portal.
- Remover a dependência de matrícula ativa em 2026 no `getAlunoContext`.
- Separar ausência de turma, dívida e conclusão pendente.
- Adicionar testes unitários para os estados.

### Dia 3 — Secretaria e base de dados

- Corrigir listagem do balcão/rematrícula.
- Integrar a validação da turma destino com `preparar_aluno_para_rematricula`.
- Aplicar a decisão fechada: criar a reserva antes da regularização financeira
  e permitir a ativação somente depois da regularização.
- Preparar migration ou RPC, se necessário.
- Validar a criação/reutilização da reserva e a posterior ativação da matrícula
  2026.

### Dia 4 — Interface e integração

- Atualizar mensagens do portal e da secretaria.
- Executar testes de integração.
- Validar pagamentos, acordos e idempotência.

### Dia 5 — Dados reais e entrega

- Rever individualmente os alunos da Enfermagem.
- Aplicar apenas correções aprovadas e auditadas.
- Executar checklist P0 e testes de regressão.
- Documentar resultado, pendências e plano de acompanhamento.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Reativar matrícula histórica | Estado académico incorreto | Manter 2025 encerrado e criar fluxo de transição |
| Ativar matrícula 2026 antes do pagamento | Matrícula oficial sem confirmação financeira | Manter a reserva pendente/inativa e bloquear apenas a ativação final |
| Dívida calculada em duplicado | Bloqueio indevido | Filtrar por aluno, matrícula e ano |
| Turma destino inexistente | Rematrícula incompleta | Validar turma antes da confirmação |
| Estados inconsistentes entre portal e secretaria | Operação divergente | Centralizar contrato de elegibilidade |
| Reenvio da confirmação | Matrículas duplicadas | Idempotência e constraint adequada |

## Fora do escopo

- Migração geral de todos os históricos da escola.
- Alteração de políticas RLS.
- Alteração de dados financeiros sem conferência documental.
- Refatoração completa do módulo académico.
- Mudança de regras de propinas não aprovada pela direção.

## Definição de pronto

O sprint estará concluído quando o fluxo completo funcionar em ambiente de validação para os casos da Enfermagem, os testes obrigatórios passarem, os dados reais forem confirmados pela secretaria e não existir matrícula histórica reativada artificialmente.

**Estado atual:** parcial. O fluxo principal e a experiência de seis etapas
estão implementados localmente e a migration de resultado académico já está
aplicada no remoto, mas o sprint ainda não está pronto: faltam
validação integrada dos 13 cenários, separação
de valores vencidos e futuros, regra de acordo aprovado e edição contextual de
notas/frequência. A paridade de preço por classe e a recuperação contextual do
modal foram implementadas localmente e ainda precisam de validação integrada.

## Decisões pendentes da escola

- [ ] Confirmar se as alunas da 10.ª classe de Enfermagem foram aprovadas para a 11.ª classe.
- [ ] Confirmar a política de bloqueio por dívida: pagamento integral ou acordo aprovado.
- [ ] Confirmar se a escola permite inscrição condicional com disciplinas em
  atraso e quais limites se aplicam.
- [ ] Confirmar se a matrícula condicional exige exame extraordinário antes da
  ativação definitiva.
- [ ] Confirmar se a taxa de rematrícula é obrigatória.
- [ ] Confirmar quais turmas de 11.ª classe serão destinos oficiais em 2026.
- [x] Reserva académica antes do pagamento; ativação final somente depois da
  regularização financeira.
