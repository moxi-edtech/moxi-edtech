# POP-P0-03 - Turmas, Curriculo e Tratamento de Cursos (Admin)

Versao: 1.5.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 20-60 minutos por ciclo de curso

## 1. Objetivo

Padronizar o tratamento de cursos no sistema, cobrindo os dois caminhos operacionais reais:
- fluxo assistido de `Onboarding` (Academic Setup Wizard)
- fluxo paralelo de `Configurações` (`Turmas & Currículo` + `Oferta Formativa`)

Complemento operacional:
- para `quadro de horario`, `regras de avaliacao/frequencia` e integracao final com publicacao, seguir o POP dedicado `p0-avaliacao-quadro-horario.md`.

## 2. Quando usar

- Inicio de ano letivo com estrutura ainda nao consolidada.
- Criacao de novos cursos por preset ou curso customizado.
- Ajuste de classes base, disciplinas e publicacao de curriculo.
- Geracao/regeracao de turmas antes de matriculas.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel academico: Secretaria/Coordenacao pedagogica
- Escalonamento: Suporte tecnico

## 4. Onde os cursos sao configurados no sistema

1. `Admin > Configurações` (hub):
- abre `Iniciar Assistente` (Academic Setup Wizard)
2. `Assistente` (onboarding academico):
- passo `Oferta Formativa` para compor matriz por cursos/presets
3. `Admin > Configurações > Turmas & Currículo`:
- command center por curso (publicar, classes base, disciplinas, gerar turmas)
4. `Admin > Configurações > Oferta Formativa`:
- instalacao rapida de presets
- criacao de curso customizado
- gestao detalhada por curso (`turmas`, `disciplinas`, `avaliação`)

## 5. Como o sistema trata um curso (modelo operacional)

1. Um curso entra por `preset` ou `custom`.
2. O sistema materializa estrutura academica do curso (classes + matriz de disciplinas).
3. O curriculo nasce em estado de trabalho e precisa de publicacao.
4. So depois da publicacao o curso pode gerar turmas com base no curriculo.
5. As turmas geradas herdam a base curricular para operacao (disciplinas/carga/turno).

## 6. Efeito domino na instalacao/adicao de curso

1. `Instalar/Adicionar curso`:
- executa lock de instalacao
- cria/aplica estrutura academica do curso (quando ainda nao existe publicado para aquele contexto)
2. `Matriz curricular`:
- disciplina, classe, carga e metadados passam a existir para o curso
- se faltar matriz, o backend tenta backfill tecnico
3. `Publicacao de curriculo`:
- valida pendencias obrigatorias (ex.: carga, classificacao, periodos, entra_no_horario, avaliacao)
- sem publicacao valida, a cadeia para aqui
4. `Geracao de turmas`:
- exige curriculo publicado por classe
- cria turmas por classe/turno/quantidade e alimenta operacao academica
5. `Commit de configuracao`:
- fecha o ciclo operacional do setup com idempotencia

Impacto pratico:
- alterar curso mexe em `curriculo -> turmas -> horarios -> atribuicoes docentes -> lancamentos`.
- por isso, instalar/adicionar curso sem concluir `publicar + gerar + commit` deixa o fluxo incompleto.

Diagrama textual de dependencias:
```text
[CURSO]
  -> cria/atualiza estrutura academica
  -> classes + matriz de disciplinas

[CURRICULO]
  -> rascunho -> publicado (com validacoes)
  -> define carga, avaliacao e disciplina por classe

[TURMAS]
  -> geradas a partir do curriculo publicado
  -> turma_disciplina passa a existir por turma

[HORARIOS]
  -> slots (capacidade) + quadro (distribuicao)
  -> usa carga/entra_no_horario do curriculo/turma_disciplina

[PROFESSORES]
  -> atribuicao em turma x disciplina
  -> impacta quadro e operacao docente

[LANCAMENTOS]
  -> notas/frequencias/documentos dependem da cadeia acima consistente
```

## 7. Pre-condicoes

- Acesso a `Admin > Configuracoes`.
- Ano letivo e periodos com estado minimamente definido.
- Janela de alteracao autorizada.

## 8. Procedimento A - Escolher o fluxo correto de cursos

1. Se a escola esta em setup inicial:
- usar `Iniciar Assistente` no hub de configuracoes.
2. Se os cursos ja existem e o objetivo e ajustar/publicar/gerar:
- usar `Configurações > Turmas & Currículo`.
3. Se precisa criar curso novo (preset ou custom) fora do wizard:
- usar `Configurações > Oferta Formativa`.

Regra:
- Evitar executar geracao de turmas nos dois fluxos ao mesmo tempo para o mesmo curso.

## 9. Procedimento B - Fluxo onboarding (Academic Setup Wizard)

1. Em `Admin > Configurações`, clicar `Iniciar Assistente`.
2. No passo `Sessão`, concluir ano letivo e trimestres.
3. No passo `Regras`, concluir frequencia e avaliacao.
4. No passo `Oferta Formativa`:
- selecionar categoria de preset (`Ensino Geral`, `Indústria & Tec`, `Serviços & Saúde`)
- adicionar curso(s) ao conjunto
- ajustar matriz de turmas por turno (`Manhã`, `Tarde`, `Noite`)
- ajustar carga horaria por curso/classe no bloco de visao macro
5. Clicar `Concluir Configuração` para aplicar presets.
6. No passo `Gerar`, confirmar e clicar `Gerar Turmas e Finalizar`.

Comportamento tecnico observado:
- o wizard instala preset com `autoPublish: false` e `generateTurmas: false`
- no passo final ele publica curriculo por curso e depois gera turmas

## 10. Procedimento C - Fluxo paralelo em Turmas & Curriculo

1. Abrir `Configurações > Turmas & Currículo`.
2. Para cada curso, verificar card:
- estado (`Currículo Publicado` ou `Rascunho`)
- versao `v.x`
- total de `classes base`
3. `Disciplinas`:
- criar/editar/remover disciplina
- validar classificacao, carga, avaliacao e aplicacao por classe
4. `Classes base`:
- criar (`Nova classe`), editar e remover
- definir turno (`M`, `T`, `N`)
- salvar mudancas
5. `Publicar`:
- abrir modal `Publicar currículo`
- confirmar publicacao e avaliar opcao de rebuild
- se `rebuild` ficar desmarcado e existirem turmas, confirmar publicacao sem rebuild
- validar no retorno da publicacao:
- `sync_turmas` (resumo geral)
- `sync_existing_turmas.executed` (se sincronizou turmas existentes)
- `sync_existing_turmas.inserted` (quantidade de vinculos `turma_disciplinas` sincronizados)
6. `Gerar turmas`:
- disponivel apos curriculo publicado
- definir quantidade por classe/turno
- confirmar geracao
7. Finalizar com `Salvar/Publicar` do shell (`setup/commit`).

Regra de bloqueio:
- se houver `Classes sem currículo publicado`, publicar antes de gerar turmas.

## 11. Procedimento D - Fluxo de Oferta Formativa (estrutura)

1. Abrir `Configurações > Oferta Formativa`.
2. Escolher uma acao:
- `Instalação rápida` de preset
- `Configurar preset` com classes/disciplinas customizadas
- `Criar curso customizado` do zero
3. No curso customizado:
- criar curso
- criar classes
- criar disciplinas por classe
4. Abrir manager do curso para manutencao:
- separador `Turmas`
- separador `Disciplinas`
- separador `Avaliação`
5. Publicar curriculo e gerar turmas quando aplicavel.

## 12. Resultado esperado

- Cursos tratados pelo fluxo adequado ao contexto (setup inicial x manutencao).
- Curriculo publicado por curso/classe conforme necessidade.
- Classes base e disciplinas consistentes.
- Turmas geradas com sucesso para o ano letivo.

## 13. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Nenhum curso cadastrado` | Oferta formativa ainda nao criada | Criar curso em `Oferta Formativa` ou pelo assistente | Curso criado nao aparece |
| `Publique o currículo...` ao gerar turmas | Curso/classe em rascunho | Publicar curriculo primeiro | Mesmo publicado continuar bloqueado |
| `permission denied: admin_escola required` ao publicar | Usuario sem papel operacional exigido no contexto da escola | Validar papel em `profiles` e `escola_users` (`admin_escola`/`admin`) e repetir publicacao | Papel correto e erro persistir |
| Falha ao salvar classes base | Dados invalidos ou conflito | Revisar linha alterada e salvar novamente | Erro recorrente |
| Falha em instalar preset | Parametros invalidos ou erro backend | Repetir com preset valido | Persistencia do erro |
| `step=orchestrator` no install | Falha transacional na RPC orquestradora | Corrigir causa raiz e reexecutar install (rollback total garantido) | Reincidencia apos nova tentativa |
| Geracao de turmas parcial | Matriz/quantidade inconsistente | Revisar matriz e repetir | Divergencia sistemica recorrente |

## 14. Evidencias obrigatorias

- Captura do fluxo usado (`Assistente`, `Turmas & Currículo` ou `Oferta Formativa`).
- Captura de estado final por curso (`publicado/rascunho`, versao, classes base).
- Registo de turmas geradas (curso, classe, turno, quantidade).
- Operador e timestamp.

## 15. Referencia tecnica (fiel ao codigo)

- Hub/assistente:
- `GET /api/escola/{id}/admin/setup/status`
- `GET /api/escola/{id}/admin/setup/state`
- `POST /api/escola/{id}/admin/ano-letivo/upsert`
- `POST /api/escola/{id}/admin/periodos-letivos/upsert-bulk`
- `POST /api/escola/{id}/admin/configuracoes/avaliacao-frequencia`
- Curriculo e turmas:
- `GET /api/escola/{id}/admin/curriculo/status`
- `POST /api/escola/{id}/admin/curriculo/install-preset`
  - caminho principal usa RPC transacional unica `curriculo_install_orchestrated` (`apply -> publish -> backfill_matriz -> generate_turmas`)
  - retorno operacional inclui `operation_status` por etapa
  - fallback legado existe apenas quando a RPC nao estiver disponivel no ambiente
- `POST /api/escola/{id}/admin/curriculo/publish`
  - retorno operacional inclui `sync_existing_turmas` quando publica sem rebuild com turmas ja existentes
  - `sync_existing_turmas` inclui `sync_mode` (`additive|reconcile`) e relatorio de obsoletas (`obsolete_count`, `obsolete_sample`)
  - modo `reconcile` exige confirmacao explicita (`confirmReconcileSync=true`) para remover obsoletas seguras
- `POST /api/escola/{id}/admin/turmas/generate` (com `Idempotency-Key`)
- Estrutura paralela:
- `GET/POST /api/escolas/{id}/cursos`
- Relacao avaliacao x curso:
- `GET /api/escolas/{id}/cursos/{cursoId}/avaliacao`
- `POST /api/escolas/{id}/cursos/{cursoId}/avaliacao`
- `GET/POST/PUT/DELETE /api/escolas/{id}/classes`
- `GET/POST/PUT/DELETE /api/escolas/{id}/disciplinas`
- Commit final de configuracao:
- `POST /api/escola/{id}/admin/setup/commit` (com `Idempotency-Key`)

## 16. KPI operacional

- Taxa de publicacao de curriculo sem retrabalho: >= 90%.
- Taxa de geracao de turmas sem erro: >= 95%.
- Tempo medio por curso (publicar + gerar): ate 60 min.

## 17. Riscos e controles

- Risco: criar/alterar curso no fluxo errado e gerar retrabalho.
- Controle: decisao inicial obrigatoria (assistente vs fluxo paralelo).

- Risco: gerar turmas com curriculo parcialmente publicado.
- Controle: validar pendencias por classe antes da geracao.

- Risco: alteracao estrutural sem publicacao/commit final.
- Controle: executar `Salvar/Publicar` no shell ao final.

## 18. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: install-preset migrado para RPC orquestradora transacional unica, mantendo sincronizacao com `sync_mode` no publish.
