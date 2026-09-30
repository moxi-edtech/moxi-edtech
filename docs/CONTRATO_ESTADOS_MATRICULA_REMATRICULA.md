# Contrato de estados — Matrícula, resultado académico e rematrícula

**Versão:** 1.2

**Data:** 2026-08-23

**Âmbito:** KLASSE — Secretaria, Portal do Aluno, Académico e Financeiro

## Objetivo

Separar claramente:

1. o ciclo de vida operacional da matrícula;
2. o resultado académico do aluno no ano letivo;
3. o processo de rematrícula para o ano seguinte.

Estas dimensões são relacionadas, mas não devem ser misturadas no mesmo
estado textual.

## Modelo recomendado

### Estado operacional da matrícula

Indica se a matrícula está operacionalmente válida:

```text
pendente   — criada, mas ainda não confirmada
ativa      — matrícula oficial em vigor
encerrada  — ano letivo finalizado
cancelada  — anulada sem validade operacional
transferida — transferência formal ou reconciliação com destino já vinculado;
               não é o fecho automático da progressão anual
```

### Resultado académico

Indica o resultado do ano letivo:

```text
pendente   — notas/decisão ainda não fechadas
aprovado   — aluno transita para a classe seguinte
reprovado  — aluno permanece na mesma classe
concluido  — aluno concluiu o ciclo/finalidade académica
```

`encerrada` não significa necessariamente `aprovado`. Um aluno reprovado
também tem a matrícula encerrada, mas o resultado académico é `reprovado`.

No modelo físico atual, esta separação é representada por
`matriculas.status = 'concluido'`/`ativo = false` e
`historico_anos.resultado_final = 'aprovado'|'reprovado'|'concluido'`. O valor
`reprovado` não é um status canónico de `matriculas`. `transferido` não deve ser
usado para encerrar uma progressão anual normal.

## Matriz de estados válida

| Situação | Estado operacional | Resultado académico | Pode originar rematrícula? |
|---|---|---|---|
| Aluno ainda em aulas | `ativa` | `pendente` | Não, até fechar o ano |
| Aluno aprovado | `encerrada` | `aprovado` | Sim, para a classe seguinte |
| Aluno reprovado | `encerrada` | `reprovado` | Sim, para a mesma classe |
| Finalista que concluiu o ciclo | `encerrada` | `concluido` | Conforme regra do ciclo |
| Matrícula 2026 reservada | `pendente` | não aplicável | É o destino da rematrícula |
| Rematrícula confirmada | `ativa` | `pendente` | Já concluída para o processo |

## Fluxo canónico

```text
Matrícula 2025 ativa / resultado pendente
        ↓ fecho académico
Matrícula 2025 encerrada + aprovado/reprovado/concluido
        ↓ definição da progressão
Pedido/reserva de rematrícula 2026
        ↓ regularização financeira, quando aplicável
Matrícula 2026 ativa
        ↓
Matrícula 2025 preservada como histórico concluído/reprovado
```

## Regras de progressão

- `aprovado`: destino é a classe imediatamente seguinte.
- `reprovado`: destino é a mesma classe, salvo decisão formal de exceção.
- `concluido`: não deve ser enviado para uma classe seguinte automaticamente.
- `pendente`: não permite confirmação de rematrícula; exige conclusão da
  avaliação ou revisão pela secretaria.
- A decisão final deve continuar centralizada em
  `resolve_raa_progression_for_matricula`.

## Disciplinas pendentes e dependências

Uma disciplina em atraso é uma pendência académica. Não deve alterar
automaticamente o estado da matrícula nem ser confundida com dívida de
propinas.

O RAA já devolve `disciplinaIdsPendentes` e decisões próprias para este caso:

| Situação académica | Decisão RAA | Destino | Rematrícula |
|---|---|---|---|
| Notas ou dados incompletos | `pendente` | indefinido | Bloqueada até completar os dados |
| Negativa dentro da faixa permitida | `inscricao_condicional` | Próxima classe | Permitida conforme política; pode exigir exame extraordinário |
| Disciplina em recurso | `recurso` | Conforme RAA | Bloqueada ou condicional, conforme política |
| Negativas acima do limite | `retido` | Mesma classe | Permitida para repetição, após validação financeira |
| Retenção por faltas | `retido_por_faltas` | Mesma classe | Conforme regra escolar |
| Retenção por indisciplina | `retido_por_indisciplina` | Mesma classe | Exige decisão administrativa |
| Sem disciplinas pendentes | `transitou` ou `concluiu` | Próxima classe ou conclusão | Permitida conforme o ciclo |

### Regras para escolas que trabalham com dependências

- A escola deve configurar `permitir_inscricao_condicional` e
  `permitir_progressao_com_recurso`.
- As disciplinas pendentes ficam no resultado RAA, não num novo estado da
  matrícula.
- A matrícula destino pode ser uma reserva, mas a ativação deve respeitar
  `efetivacaoMatriculaBloqueada` quando a política exigir exame ou recurso.
- O portal deve apresentar as disciplinas, o motivo e a próxima ação.
- A secretaria deve acompanhar recurso, exame extraordinário e dependência.
- `pendente` na matrícula significa “não confirmada”; não significa “tem uma
  disciplina em atraso”.

### Exemplo

Uma aluna da 10.ª classe com uma disciplina negativa dentro da faixa legal:

```text
Matrícula 2025: encerrada
Resultado: inscricao_condicional
Disciplinas pendentes: [disciplina_id]
Destino académico: 11.ª classe
Matrícula 2026: reserva pendente ou confirmação condicionada
```

Se a política da escola não permitir progressão condicional:

```text
Matrícula 2025: encerrada
Resultado: reprovado/retido
Destino académico: 10.ª classe
```

Em ambos os casos, a situação financeira é avaliada separadamente.

## Regra financeira

As propinas vencidas pertencem à validação da rematrícula, não ao resultado
académico.

- Dívida não altera `aprovado`, `reprovado` ou `concluido`.
- Dívida não bloqueia a criação ou reutilização da reserva destino
  `pendente`, `ativo = false`.
- Dívida vencida pode bloquear somente a confirmação/ativação da matrícula
  destino.
- Pagamento ou acordo aprovado permite concluir a rematrícula conforme a
  política da escola.
- Valores futuros não devem ser tratados como dívida vencida.
- O cálculo deve ficar limitado à matrícula/ano de origem e considerar a data
  de vencimento; cobranças do ano destino não podem bloquear retroativamente a
  transição académica.

### Preço canónico da rematrícula

- A taxa é resolvida pela classe e curso destino determinados pelo RAA, nunca
  apenas pela classe de origem ou pelo valor global do serviço.
- A prioridade é: curso + classe → classe → curso → tabela geral → valor global
  de `SERV_REMATRICULA`.
- Portal, balcão e lote devem usar a mesma regra de resolução.
- O valor, a origem do preço, a tabela, o curso e a classe destino ficam
  congelados no pedido e na intenção de pagamento.
- Uma alteração posterior da tabela não modifica pedidos já iniciados.
- Se o destino ou o preço não puderem ser resolvidos, não se cria cobrança; a
  interface apresenta a configuração em falta e a ação para a secretaria.

### Comprovativo consolidado de mensalidades

O aluno pode seleccionar até 24 mensalidades em aberto e enviar um único
comprovativo pelo total exacto do saldo pendente. A experiência é consolidada,
mas a contabilidade preserva uma alocação `pagamentos` por mensalidade para
recibos, auditoria e reconciliação.

Todas as alocações recebem o mesmo `lote_id`. A secretaria vê uma única decisão
operacional; aprovação ou rejeição processa o lote completo na mesma transacção.
Falha num item implica rollback de todos os itens. A rematrícula só pode ser
liberada depois de todas as mensalidades abrangidas ficarem efectivamente
liquidadas.

Estado em 2026-08-23: implementado localmente e aplicado no ambiente remoto;
versão registada: `20270823170000`.

## Implementação no modelo atual

Até existir uma migration estrutural, o sistema atual deve aplicar este
mapeamento compatível:

| Contrato recomendado | Estado atual compatível |
|---|---|
| Matrícula oficial ativa | `status = 'ativo'` e `ativo = true` |
| Matrícula histórica aprovada | `status = 'concluido'`, `ativo = false` |
| Matrícula histórica reprovada | `status = 'reprovado'`, `ativo = false` |
| Reserva de destino | `status = 'pendente'`, `ativo = false` |
| Destino confirmado | `status = 'ativo'`, `ativo = true` |
| Origem após destino confirmado | Preserva `concluido`/`reprovado`, `ativo = false` |

Uma origem `transferido` só pode voltar a ser resolvida no fluxo para recuperar
ou reconciliar uma matrícula destino já existente e ligada por
`origem_transicao_matricula_id`. Não pode iniciar uma segunda transição nem ser
tratada como sinónimo de resultado académico concluído.

O valor `pendente` não deve ser usado para representar simultaneamente:

- resultado académico não fechado na matrícula de origem; e
- reserva de rematrícula no ano destino.

Quando `status` e `resultado_final` forem separados por migration, o campo
`resultado_final` será a fonte académica e `status` ficará apenas com o ciclo
operacional.

## Transições permitidas

```text
ativa + pendente  → encerrada + aprovado
ativa + pendente  → encerrada + reprovado
ativa + pendente  → encerrada + concluido

encerrada + aprovado/reprovado
  → destino pendente
  → destino ativa após confirmação

destino ativa
  → origem preservada como histórico concluído/reprovado
```

## Transições proibidas

- `encerrada + aprovado` voltar para `ativa` no mesmo ano.
- `encerrada + reprovado` ser tratado como aprovado.
- Criar estado `promovido`, `aguardando_pagamento` ou `pre_matriculado`.
- Criar matrícula destino oficial enquanto ainda está apenas reservada.
- Bloquear a criação da reserva apenas por existir dívida financeira.
- Usar dívida financeira para alterar o resultado académico.
- Criar uma segunda tabela de estados paralela às matrículas existentes.

## Contratos técnicos a reutilizar

- `canonicalize_matricula_status_text`
- `resolve_raa_progression_for_matricula`
- `preparar_aluno_para_rematricula`
- `finalizar_rematricula_balcao`
- `rematricula_em_massa`
- `origem_transicao_matricula_id`
- `session_id` como referência do ano letivo

O portal e a secretaria devem consultar estes contratos, sem reproduzir regras
de progressão ou elegibilidade em componentes isolados.

Existem três entrypoints legítimos de confirmação — portal do aluno, balcão e
lote da secretaria. Não precisam usar a mesma função pública, mas todos devem
aplicar o mesmo contrato transacional: tenant, RAA, turma compatível,
idempotência, dívida vencida, ativação do destino, fecho da origem e auditoria.

O preço é parte deste contrato transacional. Uma entrada não pode mostrar ou
cobrar valor diferente das demais para a mesma classe destino.

## Experiência operacional canónica

O administrador deve executar a transição num cockpit contextual, preservando
escola, ano, turma, filtros e aluno selecionado ao resolver exceções:

1. completar dados de 2025: notas, frequência e dados necessários ao RAA;
2. calcular aprovação, retenção, recurso, inscrição condicional ou conclusão;
3. encerrar as matrículas e o histórico de 2025;
4. gerar reservas de 2026 em lote, sempre `pendente` e `ativo = false`;
5. encaminhar aprovados para a classe seguinte e retidos para a mesma classe;
6. ativar somente os destinos academicamente válidos e financeiramente
   regularizados.

Pendências devem abrir no mesmo contexto, preferencialmente em painel ou modal.
Quando uma área especializada for inevitável, o retorno deve restaurar o
cockpit, ano, turma, filtros e aluno.

No portal, a jornada financeira deve preservar o mesmo contexto:

1. mostrar dívida consolidada e respetivas mensalidades;
2. receber comprovativo e indicar claramente que está em validação;
3. atualizar o estado ao regressar à página ou quando a validação terminar;
4. mostrar classe destino e taxa canónica antes de iniciar o pagamento;
5. após validação da taxa, encaminhar a secretaria diretamente ao modal de
   turma destino, sem pesquisa ou navegação adicional.

## Estado da implementação em 2026-08-23

| Capacidade | Estado |
|---|---|
| Origem histórica `concluido`/`reprovado` no portal | Implementada no working tree |
| Validação RAA antes da rematrícula | Implementada no working tree |
| Reserva desacoplada da dívida na simulação/cockpit | Implementada no working tree |
| Percurso UX explícito de seis etapas | Implementado no working tree |
| Preço da rematrícula pela classe destino no portal | Implementado no working tree |
| Snapshot de preço no pedido/intenção | Preparado em migration não aplicada |
| Recuperação do modal para origem histórica | Implementada no working tree |
| Atualização do banner ao regressar ao portal | Implementada no working tree |
| Guards RAA/financeiro nas RPCs de portal, balcão e lote | Preparados em migrations não aplicadas |
| Separação estrutural entre `status` e `resultado_final` | Não implementada |
| Filtro estrito de dívida vencida versus valores futuros | Pendente |
| Acordo aprovado como desbloqueio financeiro | Pendente de política e implementação |
| Correcção inline de notas/frequência no cockpit | Pendente |
| Aplicação e validação no banco remoto | Pendente de aprovação |

## Aplicação ao caso de Enfermagem

Para uma aluna da 10.ª classe:

- se aprovada: matrícula 2025 `encerrada/concluido` e destino 11.ª classe;
- se reprovada: matrícula 2025 `encerrada/reprovado` e destino 10.ª classe;
- em ambos os casos: verificar propinas vencidas antes de ativar a matrícula
  2026;
- a matrícula 2025 nunca deve permanecer `pendente` se o resultado já foi
  decidido.

## Critérios de conformidade

- [ ] Cada matrícula histórica tem resultado académico explícito.
- [ ] Cada matrícula destino provisória está inativa.
- [ ] Apenas a matrícula destino confirmada fica ativa.
- [ ] Portal e secretaria usam a mesma decisão RAA.
- [ ] Dívida bloqueia a operação financeira, não o resultado académico.
- [ ] Não existem estados paralelos fora deste contrato.
- [ ] As transições críticas são auditadas.
