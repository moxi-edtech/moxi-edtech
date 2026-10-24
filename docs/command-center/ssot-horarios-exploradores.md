# SSOT — Horários nos Exploradores do Command Center

**Estado:** contrato de implementação, não funcionalidade publicada. **Data:** 24/10/2026.
**Escopo:** Curso, Classe, Turma, Professor e Disciplina. Reutilizar o sistema de horários instalado, sem um segundo motor ou segundo cadastro.

## Decisão de produto

O **horário oficial** é o conjunto de aulas de `quadro_horarios` da versão `horario_versoes.status = 'publicada'` da turma, cruzado com `horario_slots`. Uma atribuição académica (`turma_disciplinas` / `turma_disciplinas_professores`) **não é** uma aula programada; uma versão `draft` **não é** um horário publicado. Versões arquivadas só aparecem em contexto histórico explicitamente selecionado.

O Command Center é **leitura contextual**, não editor de horários. Gestão, distribuição automática, conflitos, publicação e PDF continuam nos módulos existentes. Não criar tabelas, migrations, CRUD, wizard, calendário paralelo nem motor de alocação.

## Fonte de verdade e leitura

| Dado | Fonte instalada | Regra |
| --- | --- | --- |
| Escola, ano, curso, classe, turma | `turmas` + contexto académico já utilizado nos exploradores | Filtrar sempre por escola e ano; turma define curso/classe |
| Versão oficial | `horario_versoes` | Apenas `publicada`; ordenar por `publicado_em`; não misturar versões |
| Aula | `quadro_horarios` | Vincular `versao_id`, `turma_id`, `escola_id` |
| Dia, início, fim, intervalo, turno | `horario_slots` | Ordenar dia + hora; não usar `ordem` isolada entre turnos |
| Disciplina | `disciplinas_catalogo` via `disciplina_id` | Nome oficial |
| Docente da aula | `quadro_horarios.professor_id` | `NULL` = docente **não indicado no horário**, nunca «professor não vinculado» |
| Vínculo docente | `turma_disciplinas` e `turma_disciplinas_professores` | Exibir separadamente como atribuição, não preencher silenciosamente o horário |
| Sala | `quadro_horarios.sala_id` → `salas` | `NULL` = sala não indicada; turma.sala não substitui automaticamente a sala da aula |

**Contrato de API:** criar, quando necessário, **uma única leitura agregada e paginada** de horários publicados para um conjunto limitado de `turma_ids`, reutilizando autorização, ano letivo e helpers existentes. Projetar os cinco exploradores a partir do mesmo conjunto normalizado de aulas. Não efetuar N+1 chamadas por turma, não carregar todas as escolas e não usar endpoints de edição para simples leitura. Se o endpoint existente satisfizer o caso, reutilizá-lo em vez de criar outro.

Resposta mínima sugerida: `{ turmaId, versaoId, publicadoEm, diaSemana, inicio, fim, slotId, disciplinaId, disciplinaNome, professorId, professorNome, salaId, salaNome }`. Metadados separados: `{ scope: { escolaId, anoLetivoId }, coverage: { totalTurmas, comHorarioPublicado }, partial, nextCursor }`. Não devolver contactos, remunerações ou outros dados pessoais.

## Apresentação otimizada

**Padrão:** um único componente de leitura `HorarioResumo` com `variant='compact' | 'weekly' | 'list'`, sem drag-and-drop. Sem cartões repetitivos. Carregamento sob demanda quando a secção for aberta; skeleton curto, erro recuperável e estado vazio explícito. Mobile: lista por dia. Desktop: grelha semanal simples, com linhas para tempos, sem depender de zoom ou largura fixa. Reutilizar tipografia, spacing, tokens e ações do Command Center.

| Explorador | Apresentação | Ação |
| --- | --- | --- |
| **Turma** | Grelha semanal do horário publicado, disciplina + professor/sala quando conhecidos, data da publicação | «Abrir gestão de horários»; PDF existente quando permitido |
| **Professor** | Agenda semanal **apenas das aulas cujo professor_id coincide**, agrupadas por dia; atribuições sem aula continuam separadas | Abrir turma |
| **Disciplina** | Próximas ocorrências semanais por turma, filtradas pela disciplina, com curso/classe/turno | Abrir turma |
| **Classe** | Resumo de cobertura (turmas com/sem horário) + seleção de uma turma para ver grelha | Abrir turma |
| **Curso** | Cobertura por classe/turma e lista compacta de turmas sem publicação; sem mega-grelha agregada | Abrir classe ou turma |

**Hierarquia:** turma é a unidade de publicação. Curso e Classe mostram **cobertura**, não fingem ter um horário único. Professor e Disciplina mostram **projeções** das aulas publicadas, não publicações próprias.

**Estados inequívocos:**
- `sem_publicacao`: «Esta turma ainda não tem horário publicado».
- `rascunho_existente`: só informar aos perfis autorizados; nunca mostrar aulas do draft como oficiais.
- `professor_id = null`: «Professor não indicado no horário»; mostrar atribuição académica noutro bloco se houver.
- `sala_id = null`: «Sala não indicada».
- `partial = true`: «Resultados parciais» com continuação, nunca «sem horários».
- Ano histórico: mostrar publicação da turma daquele ano com contexto «Histórico», sem misturar anos.

## Auditoria de referência — leitura Supabase em 24/10/2026

Consultas agregadas de leitura, sem alterações: 36 versões (14 publicadas, 19 draft, 3 arquivadas), 373 aulas em versões publicadas, 14 turmas com horário publicado, 122 slots em duas escolas; 364 das 373 aulas publicadas sem `professor_id`, 144 sem `sala_id`; 33 das aulas sem professor no quadro têm um único vínculo docente académico, mas **não** devem ser atribuídas automaticamente; 331 não têm vínculo docente direto único nessa comparação. Das 14 publicações, 2 pertencem a anos letivos ativos e 12 a anos não ativos. Quatro escolas possuem turmas, duas possuem publicações. Zero versões publicadas vazias; zero colisões de professor/sala identificadas entre aulas publicadas com os IDs preenchidos; zero referências quebradas de slots, disciplinas ou salas publicadas no recorte verificado.

**Atenção:** estes números são fotografia operacional, não critérios de aceite estáticos nem autorização para alterar dados.

## Riscos encontrados no código instalado

1. `GET /api/escolas/[id]/horarios/quadro` exige `authorizePedagogicalManage` até para leitura; não reutilizar diretamente para todos os perfis dos exploradores sem rever a autorização de leitura.
2. `GET /api/escolas/[id]/horarios/slots` usa `authorizeTurmasManage` e limite padrão de 50, embora existam 122 slots no banco; isso pode truncar a grelha. Criar paginação/consulta filtrada sem remover guardas.
3. `GET /api/secretaria/turmas/[id]/horario/versao` **cria um draft num GET** quando não existe: não usar para os exploradores read-only.
4. `useHorarioData.mapSlots` e `TurmaHorarioModal` usam dia/ordem e assumem segunda a sexta; múltiplos turnos podem colidir. Na visualização oficial, usar `slot_id` e `turno_id`, sem agrupar apenas por `ordem`.
5. `ProfessorContextView` já mostra uma lista de horários publicados; **evoluir esse bloco**, não criar um segundo. A API do professor já filtra status `publicada`, mas só reconhece aulas com `quadro_horarios.professor_id` preenchido.
6. As rotas de professor e aluno já expõem horários publicados; preservar o comportamento e as permissões desses portais.

## Backlog pequeno, por ordem

- **HOR-EX-001 (P0):** contrato único de leitura e normalização + autorização de leitura + paginação/limites/escopo; testes de isolamento, versões e resultados parciais.
- **HOR-EX-002 (P0):** componente de apresentação reutilizável, sem lógica de edição, com estados vazio/erro/partial e grelha/lista responsiva.
- **HOR-EX-003 (P1):** integrar Turma e **melhorar o bloco existente** de Professor.
- **HOR-EX-004 (P1):** projetar Disciplina, Classe e Curso sobre o mesmo contrato, com carregamento sob demanda.
- **HOR-EX-005 (P1):** homologação autenticada com Secretaria/Direção, anos atual/histórico, turnos distintos, docente não indicado, escola sem publicação, PDF e responsividade.

**Critério de conclusão:** nenhuma alteração no motor de horários, nenhum write incidental, nenhum horário de rascunho apresentado como publicado, nenhuma mistura entre escolas/anos/turnos, nenhuma agenda docente inventada a partir de atribuições e nenhum resultado truncado apresentado como completo.

**Integração:** alinhar esta frente com o backlog `docs/command-center/explorers-redesign/` (PRs #261/#262); não duplicar o trabalho de EX-009 sobre agenda de professor. Não integrar em produção sem CI e homologação.
