# POP-P1-03 - Professores, Atribuicoes e Pendencias (Admin)

Versao: 1.1.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 10-40 minutos por ciclo

## 1. Objetivo

Padronizar a operacao do Admin para:
- cadastrar e atualizar docentes
- atribuir professor por `turma x disciplina`
- monitorar pendencias/compliance docente
- manter consistencia entre `Professores` e `Quadro de Horario`

## 2. Quando usar

- Entrada de novo professor.
- Ajuste de perfil docente (carga, turnos, habilitacoes, disciplinas habilitadas).
- Atribuicao ou remocao de docente em turma-disciplina.
- Tratamento de pendencias academicas por professor.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Coordenacao/Secretaria
- Escalonamento: Suporte tecnico

## 4. Entrada funcional no sistema (fiel ao codigo)

- `Admin > Professores` redireciona para ` /escola/{id}/professores `.
- A tela `Professores` trabalha com 3 abas:
- `Adicionar`
- `Atribuir`
- `Gerenciar`

## 5. Pre-condicoes

- Escola correta selecionada.
- Permissao para criar/editar usuario docente.
- Turmas e disciplinas ja estruturadas para atribuicao.

## 6. Procedimento A - Cadastrar professor (aba Adicionar)

1. Abrir `Professores > Adicionar`.
2. Preencher dados pessoais obrigatorios:
- nome completo
- email
- data de nascimento
- BI (14 caracteres alfanumericos)
- telefone
3. Preencher dados academicos/profissionais:
- habilitacoes
- vinculo contratual
- carga horaria maxima
- turnos disponiveis
- disciplinas habilitadas
4. Confirmar criacao.
5. Validar retorno `Professor criado com sucesso!`.
6. Se houver senha temporaria, registrar e entregar por canal seguro.

Observacao tecnica:
- Criacao persiste perfil, vinculo escolar e registro docente (`teachers`).
- Habilidades de disciplina sao gravadas em `teacher_skills`.

## 7. Procedimento B - Editar professor e acesso

1. Ir para `Professores > Gerenciar`.
2. Abrir acao de editar do professor.
3. Ajustar campos necessarios (carga, turnos, disciplinas, etc.).
4. Salvar e confirmar `Professor atualizado.`.
5. Para professor pendente, usar `Reenviar convite` quando aplicavel.
6. Para reset de acesso, usar `Gerar senha temporaria`.

## 8. Procedimento C - Atribuir professor em turma-disciplina

1. Ir para `Professores > Atribuir`.
2. Selecionar na ordem:
- professor
- curso
- turma
- disciplina
3. Confirmar atribuicao.
4. Validar retorno `Atribuição salva com sucesso.`.
5. Para desfazer, remover atribuicao na grade da turma.

Regra tecnica:
- A atribuicao usa `disciplina_id` da matriz curricular (`curso_matriz_id`).
- O endpoint faz `upsert` por `escola + turma + curso_matriz_id`.

## 9. Procedimento D - Monitorar pendencias/compliance

1. Em `Gerenciar`, abrir detalhe do professor.
2. Revisar:
- atribuicoes por turma
- carga real x carga maxima
- compliance status
- pendencias por tipo e trimestre
3. Priorizar tratativa de status critico/pendente.
4. Registrar acao operacional no controle interno.

## 9A. Procedimento E - Guardrail diario de consistencia docente

1. Executar no inicio da operacao (1x por dia):
- `GET /api/escola/{id}/admin/academico/consistencia-professores?limit=20`
2. Validar o resumo:
- `healthy = true` -> seguir operacao normal.
- `healthy = false` -> abrir tratativa no mesmo dia.
3. Prioridade de tratativa:
- `high_issues > 0`: bloqueio operacional ate saneamento.
- `medium_issues > 0`: corrigir no ciclo corrente.
4. Para cada check com problema, usar o `sample` para identificar os ids impactados.
5. Registrar evidencia da execucao diaria (timestamp + resumo + checks com `total > 0`).

## 10. Integracao com Quadro de Horario

- Atribuicao de professor no `Horarios > Quadro` usa o mesmo backend de turma-disciplina.
- Se o quadro indicar disciplina sem professor, atribuir por:
- botao de atribuicao no quadro
- ou aba `Professores > Atribuir`
- A consolidacao final deve refletir nos dois pontos.

## 11. Resultado esperado

- Professores cadastrados e atualizados com dados consistentes.
- Atribuicoes de turma-disciplina sem conflito de identidade.
- Pendencias/compliance monitoradas e tratadas.
- Quadro de horario com docentes vinculados corretamente.

## 12. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `BI deve ter 14 caracteres alfanuméricos` | BI fora do formato | Corrigir BI e submeter novamente | Persistir com BI valido |
| `Sem permissão` | Papel sem privilegio suficiente | Executar com admin autorizado | Regra de permissao divergente |
| `Professor não encontrado` | Professor inexistente na escola | Revisar cadastro/vinculo e repetir | Cadastro existe e erro persiste |
| `Disciplina/Matriz não encontrada` | disciplina enviada nao corresponde ao curso_matriz | Recarregar lista de disciplinas da turma e selecionar novamente | Erro recorrente para turma valida |
| `Informe professor_id ou professor_user_id` | payload incompleto | Reexecutar atribuicao com professor selecionado | UI enviar dado correto e backend recusar |
| `healthy=false` no guardrail | Assimetria entre `teachers/professores/skills/alocacoes` | Executar saneamento dos ids no `sample` e revalidar endpoint | Problema reaparece apos correcao |

## 13. Evidencias obrigatorias

- Captura de criacao/edicao concluida.
- Captura de atribuicao por turma-disciplina.
- Captura de pendencias/compliance do professor.
- Registo de operador, data/hora, turma e disciplina impactada.

## 14. Referencia tecnica (fiel ao codigo)

- Entrada e listagem:
- `GET /api/secretaria/professores?cargo=professor&days=&pageSize=&escola_id=`
- `GET /api/escolas/{id}/cursos`
- `GET /api/escolas/{id}/turmas`
- `GET /api/secretaria/disciplinas`

- Cadastro/edicao/acesso docente:
- `POST /api/escolas/{id}/professores/create`
- `POST /api/escolas/{id}/professores/{profileId}/update`
- `POST /api/escolas/{id}/usuarios/resend`
- `POST /api/escolas/{id}/professores/{profileId}/reset-password`
- `GET /api/escolas/{id}/professores/{profileId}/pendencias`

- Atribuicao em turma:
- `GET /api/escolas/{id}/turmas/{turmaId}/disciplinas`
- `POST /api/escolas/{id}/turmas/{turmaId}/atribuir-professor`
- `DELETE /api/escolas/{id}/turmas/{turmaId}/disciplinas/{disciplinaId}`

- Alias legados usados pelos wrappers:
- `POST /api/secretaria/turmas/{id}/atribuir-professor`
- `GET /api/secretaria/turmas/{id}/disciplinas`
- Guardrail de consistencia operacional:
- `GET /api/escola/{id}/admin/academico/consistencia-professores?limit=20`

## 15. KPI operacional

- Tempo medio de atribuicao professor-turma-disciplina: <= 5 min.
- Taxa de atribuicao sem retrabalho: >= 95%.
- Professores com pendencia critica aberta alem do prazo: 0.

## 16. Riscos e controles

- Risco: docente sem habilidade/turno compativel receber atribuicao.
- Controle: validar disciplinas habilitadas e turnos antes da atribuicao.

- Risco: divergencia entre aba Professores e Quadro.
- Controle: confirmar atribuicao final no quadro da turma.

- Risco: acesso docente sem governanca de credenciais.
- Controle: registrar envio/reenvio/reset em trilha interna.

## 17. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: adicionado procedimento diario de guardrail de consistencia docente e endpoint de diagnostico operacional.
