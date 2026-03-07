# Convenções da tabela

## Legenda
- Gatilho **H** = evento humano — alguém fez algo.
- Gatilho **S** = evento do sistema — regra temporal ou threshold.
- Tipo **I** = só informação — o sino acende, lê e fecha.
- Tipo **A** = requer acção — clica e abre modal para resolver ali mesmo.

## Super Admin → Admin da Escola
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Manutenção programada no sistema | H | I | — |
| Nova funcionalidade disponível | H | I | — |
| Limite de alunos a 80% do plano | S | A | Modal: ver planos e fazer upgrade |
| Limite de alunos a 100% — bloqueado | S | A | Modal: upgrade obrigatório para continuar |
| Subscrição expira em 7 dias | S | A | Modal: renovar subscrição |
| Subscrição expirada — acesso limitado | S | A | Modal: renovar subscrição |

## Admin → Secretaria
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Turma aprovada — pronta para matrículas | H | I | — |
| Turma rejeitada — motivo indicado | H | I | — |
| Nova propina definida — entra em vigor em mês X | H | I | — |
| Isenção ou desconto aprovado para aluno X | H | I | — |
| Importação de alunos concluída — N alunos para processar | H | A | Modal: ver lista e confirmar matrículas |

## Admin → Financeiro
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Novo catálogo de preços activado | H | I | — |
| Encerramento de período financeiro autorizado | H | A | Modal: confirmar fecho e gerar relatório |
| Desconto aprovado para aluno X | H | I | — |

## Admin → Professores
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Currículo publicado — disciplinas disponíveis | H | I | — |
| Novo ano lectivo activado | H | I | — |
| Turma X atribuída a si | H | I | — |
| Prazo de lançamento de notas em 3 dias | S | A | Modal: ir directamente para lançamento de notas |
| Prazo de lançamento de notas expirado | S | A | Modal: solicitar extensão de prazo ao admin |

## Secretaria → Professor
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Novo aluno matriculado na tua turma | H | I | — |
| Aluno X transferido para outra turma | H | I | — |
| Aluno X com matrícula cancelada | H | I | — |
| Aluno X reintegrado na turma | H | I | — |

## Secretaria → Aluno / Encarregado
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Matrícula confirmada | H | I | — |
| Documento emitido — disponível para levantamento | H | I | — |
| Renovação de matrícula disponível | S | A | Modal: iniciar renovação |
| Propina em atraso — X dias | S | A | Modal: ver detalhe e registar pagamento |
| Propina vence em 3 dias — lembrete | S | I | — |

## Professor → Aluno / Encarregado
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| Nota lançada — disciplina X, período Y | H | I | — |
| Falta registada — data X | H | I | — |
| Avaliação marcada — data X, disciplina Y | H | I | — |
| Faltas a atingir limite — N faltas registadas | S | A | Modal: ver histórico de faltas e justificar |
| Nota abaixo da média — disciplina X | S | I | — |

## Sistema → Admin
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| N professores não lançaram notas — período fecha em 5 dias | S | A | Modal: ver lista e enviar lembrete em massa |
| Turmas sem professor atribuído | S | A | Modal: atribuir professor ali mesmo |
| Ano lectivo sem períodos configurados | S | A | Modal: configurar períodos |
| N alunos sem turma atribuída | S | A | Modal: ver lista e enturmar |

## Sistema → Financeiro
| Notificação | Gatilho | Tipo | Modal de resolução |
| --- | --- | --- | --- |
| N alunos com propina em atraso há mais de 30 dias | S | A | Modal: ver lista e accionar cobrança |
| Fecho de mês — propinas não registadas | S | A | Modal: ver pendentes e reconciliar |
| Aluno com matrícula activa sem propina do mês corrente | S | I | — |

## Decisões de implementação
- Persistência: notificações ficam guardadas no Supabase numa tabela `notificacoes` com `lida`, `arquivada`, `criada_em`; o sino mostra o contador de não lidas.
- Entrega em tempo real: usar Supabase Realtime; quando uma linha é inserida em `notificacoes`, o sino acende sem recarregar a página.
- Agrupamento: agrupar notificações do mesmo tipo para evitar spam (ex.: “O professor X lançou notas em 5 disciplinas hoje”).

## Estrutura mínima em `public.notificacoes`
- `gatilho`: `H` ou `S` conforme a legenda.
- `tipo`: `I` ou `A` conforme a legenda.
- `modal_id`: identifica o modal de resolução quando `tipo = A`.
- `agrupamento_chave`: chave de deduplicação/agrupamento.
- `arquivada`: boolean para histórico/arquivo.

## Implementação (estado actual)
- Admin → Secretaria: turmas aprovadas, importações concluídas, propinas definidas.
- Admin → Financeiro: catálogo de preços activado, fecho autorizado.
- Admin → Professores: currículo publicado, ano lectivo activado, turma atribuída.
- Secretaria → Professor: matrícula confirmada, transferida, cancelada, reintegrada.
- Secretaria → Aluno/Encarregado: matrícula confirmada, documentos emitidos, renovação disponível.
- Sistema → Aluno/Encarregado: alertas de propinas via cron (`/api/cron/financeiro/propinas-alertas`).
