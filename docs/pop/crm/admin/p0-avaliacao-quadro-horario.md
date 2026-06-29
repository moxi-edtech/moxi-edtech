# POP-P0-04 - Avaliacao, Quadro de Horario e Integracao Academica (Admin)

Versao: 1.1.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 30-90 minutos por turma

## 1. Objetivo

Padronizar a operacao do Admin para:
- configurar regras de frequencia e avaliacao
- preparar estrutura de horarios (slots)
- montar/publicar quadro por turma
- manter coerencia entre `curriculo`, `carga horaria`, `regras de avaliacao` e `publicacao`

## 2. Quando usar

- No inicio do ano letivo apos configuracao de cursos/turmas.
- Sempre que houver mudanca de modelo de avaliacao ou frequencia.
- Sempre que houver ajuste de carga horaria semanal das disciplinas.
- Antes de publicar quadro oficial de turma.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel academico: Coordenacao/Secretaria
- Escalonamento: Suporte tecnico

## 4. Relacao operacional entre modulos (fiel ao codigo)

1. `Avaliacao/Frequencia` define regra global em `configuracoes_escola`.
2. `Curriculo/Disciplinas` define por disciplina:
- `entra_no_horario`
- `carga_horaria_semanal`
3. `Slots` define capacidade por turno/dia (aulas disponiveis).
4. `Quadro` distribui disciplinas da turma nos slots.
5. `Publicar quadro` so conclui quando:
- nao ha conflito de professor/sala em versoes publicadas
- nao ha disciplina obrigatoria sem carga
- nao ha diferenca entre carga esperada e quantidade alocada

Regra estrutural:
- Se `entra_no_horario = false`, disciplina nao entra no scheduler.
- Se `entra_no_horario != false` e `carga_horaria_semanal <= 0`, disciplina fica pendente e bloqueia publicacao.

## 5. Pre-condicoes

- Acesso a:
- `Admin > Configuracoes > Avaliacao`
- `Horarios > Slots`
- `Horarios > Quadro`
- Turmas e disciplinas ja criadas no fluxo academico.
- Janela de alteracao autorizada.

## 5.1 Estado fiel ao codigo

- A pagina de regras renderiza o titulo `Avaliação & Frequência`.
- Em modo consulta, o botao real é `Editar Regras`.
- Em modo edicao, as acoes reais sao `Cancelar` e `Salvar Alterações`.
- A pagina de slots salva via `Salvar estrutura de horários` e, ao concluir, oferece acao `Ir para o Quadro`.
- A pagina do quadro usa `Salvar agora` para rascunho, `Limpar quadro` para apagar a grelha da turma e `Aumentar slots para X aulas/dia` quando ha sugestao de capacidade.
- O quadro bloqueia publicacao quando faltam cargas horarias, com mensagem `Defina todas as cargas horárias antes de publicar.`

## 6. Procedimento A - Configurar regras de avaliacao/frequencia

1. Abrir `Admin > Configuracoes > Avaliacao`.
2. Clicar `Editar Regras`.
3. Em `Frequência (SSOT)`, escolher:
- `Por aula` ou `Por período`
- `% minimo de presenca` (0-100)
4. Em `Modelo de avaliação`:
- selecionar modelo existente
- validar componentes/pesos no preview
5. Clicar `Salvar Alterações`.
6. Confirmar retorno de sucesso.

Observacao tecnica:
- O backend valida payload e atualiza `configuracoes_escola`.
- Ao salvar, tambem atualiza `modelos_avaliacao.formula` para o modelo selecionado.

## 7. Procedimento B - Ajustar estrutura de slots (capacidade)

1. Abrir `Horarios > Slots`.
2. Validar estrutura por turno (`Matinal`, `Tarde`, `Noite`) e dias.
3. Selecionar turma e comparar:
- `Carga semanal da turma`
- `Slots disponiveis` no turno da turma
4. Se houver excesso de carga:
- ajustar slots manualmente e salvar
- ou, no quadro, usar `Ajustar slots` quando sugerido
5. Clicar `Salvar estrutura de horários`.
6. Confirmar retorno `Estrutura de horários salva.`.

Bloqueios/validacoes reais de slot:
- inicio deve ser menor que fim (`SLOT_TIME_RANGE_INVALID`)
- nao pode haver sobreposicao temporal no mesmo turno/dia (`SLOT_TEMPORAL_CONFLICT`)

## 8. Procedimento C - Montar quadro da turma

1. Abrir `Horarios > Quadro`.
2. Selecionar turma no topo.
3. Validar pendencias no painel lateral:
- disciplina sem carga
- conflitos
- turma sem sala
4. Distribuir disciplinas no grid (drag and drop) ou usar `Auto-Completar`.
5. Se existir pendencia de carga:
- usar `Auto-Configurar cargas`
- ou ajustar disciplina no modal de curriculo
6. Atribuir professor quando indicado.
7. Definir sala da turma quando ausente.
8. Clicar `Salvar agora` para rascunho quando a barra de persistencia aparecer.
9. Quando estiver consistente, clicar `Publicar`.

## 9. Procedimento D - Publicacao e controles finais

1. Publicar apenas quando:
- todas as disciplinas obrigatorias tiverem carga valida
- distribuicao de slots bater com carga esperada
- sem conflitos de professor/sala
2. Em caso de erro de publicacao:
- `Conflito de horário detectado` (409): ajustar professor/sala/slot
- `CARGA_HORARIA_INCOMPLETA`: corrigir carga ou distribuicao
3. Repetir `Salvar` e `Publicar` apos correcao.
4. Opcional: gerar `Baixar PDF` ou `Imprimir` para validacao operacional.

## 10. Resultado esperado

- Regras de avaliacao/frequencia aplicadas e consistentes.
- Slots sem sobreposicao e capacidade compatível com carga.
- Quadro da turma salvo/publicado sem conflitos.
- Distribuicao das disciplinas coerente com curriculo da turma.

## 11. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Dados inválidos` em avaliacao | payload fora do schema (ex.: percentual fora de faixa) | Revisar campos e salvar novamente | Erro persistir com dados validos |
| `SLOT_TIME_RANGE_INVALID` | horario inicio/fim invalido | Corrigir intervalo de tempo | Persistencia apos correcao |
| `SLOT_TEMPORAL_CONFLICT` | sobreposicao de slots no turno/dia | Ajustar ordem/horarios | Conflito sem sobreposicao aparente |
| `Conflito de horário detectado` | professor/sala ja ocupado em versao publicada | Reatribuir professor/sala ou slot | Conflito recorrente sem causa visivel |
| `CARGA_HORARIA_INCOMPLETA` | disciplina sem carga ou com alocacao diferente da carga | Ajustar carga e redistribuir | Erro manter mesmo apos ajuste |

## 12. Evidencias obrigatorias

- Captura de `Avaliacao` com modelo/frequencia aplicados.
- Captura de `Slots` com estrutura final.
- Captura do `Quadro` por turma (antes e depois da publicacao).
- Registo de operador, data/hora e turma.

## 13. Referencia tecnica (fiel ao codigo)

- Regras de avaliacao/frequencia:
- `GET /api/escola/{id}/admin/configuracoes/avaliacao-frequencia`
- `POST /api/escola/{id}/admin/configuracoes/avaliacao-frequencia`
- Modelos de avaliacao (lista):
- `GET /api/escolas/{id}/modelos-avaliacao?limit=50`
- Slots:
- `GET /api/escolas/{id}/horarios/slots`
- `POST /api/escolas/{id}/horarios/slots`
- Quadro:
- `GET /api/escolas/{id}/horarios/quadro?versao_id={uuid}&turma_id={uuid}`
- `POST /api/escolas/{id}/horarios/quadro` (`mode: draft|publish`)
- `DELETE /api/escolas/{id}/horarios/quadro?versao_id={uuid}&turma_id={uuid}`
- Apoio operacional do quadro:
- `POST /api/escolas/{id}/horarios/cargas/auto`
- `POST /api/escolas/{id}/horarios/auto`
- `POST /api/secretaria/turmas/{turmaId}/atribuir-professor`
- `POST /api/escolas/{id}/turmas/{turmaId}/sala`
- `GET /api/secretaria/turmas/{turmaId}/horario/versao?escola_id={id}`
- `GET /api/secretaria/turmas/{turmaId}/disciplinas?escola_id={id}`

## 14. KPI operacional

- Taxa de publicacao de quadro sem retrabalho: >= 90%.
- Taxa de turmas sem pendencia de carga no primeiro ciclo: >= 95%.
- Tempo medio de configuracao por turma: ate 90 min.

## 15. Riscos e controles

- Risco: alterar avaliacao sem refletir no fluxo academico.
- Controle: validar regras antes de publicar quadro.

- Risco: publicar quadro com distribuicao incompleta.
- Controle: tratar pendencias `missing/mismatch` antes de publicar.

- Risco: conflito de professor/sala entre turmas.
- Controle: revisar conflitos reportados pelo backend e republicar.

## 16. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: alinhado aos labels reais de `Avaliação & Frequência`, slots e quadro de horarios.
