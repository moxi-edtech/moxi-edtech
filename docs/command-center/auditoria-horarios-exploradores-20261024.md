# Auditoria técnica — Horários × Exploradores (2026-10-24)

> Estado: auditoria de código da `main` e leitura SQL do Supabase instalado. **Não é homologação autenticada nem implementação de UI.** Não alterar horários, publicações ou vínculos existentes para satisfazer os exploradores.

## Decisão

**Reutilizar o horário canónico existente.** Não criar tabela, editor, motor de horários, cálculo de conflitos ou fonte paralela dentro do Command Center. O explorador é uma projeção de leitura da versão **publicada** de cada turma, respeitando escola e ano letivo. Rascunhos/arquivadas são contexto administrativo separado, nunca aulas oficiais.

Fontes existentes:
- `horario_versoes`: versão por escola/turma; estados `draft`, `publicada`, `arquivada`.
- `quadro_horarios`: disciplina, turma, professor opcional, sala opcional, slot e versão.
- `horario_slots`: escola, turno, dia, ordem, início/fim, intervalo.
- `turma_disciplinas`, `turma_disciplinas_professores`, `curso_matriz`: vínculos académicos; **não equivalem** a aulas marcadas.
- `/api/escolas/[id]/horarios/quadro`, `/api/escolas/[id]/horarios/slots`, `/api/secretaria/turmas/[id]/horario/pdf`, portais de aluno/professor e `ProfessorContextView`: consumidores atuais a preservar.

## Retrato SQL do banco (2026-10-24)

| Medida | Resultado |
|---|---:|
| Slots configurados | 122 (2 escolas) |
| Versões | 36: 14 publicadas, 19 draft, 3 arquivadas |
| Turmas distintas com versão publicada | 14 |
| Versões publicadas no ano letivo ativo | 2 |
| Versões publicadas em anos não ativos | 12 |
| Linhas em quadros | 658 (373 publicadas, 198 draft, restante arquivadas) |
| Linhas publicadas sem `professor_id` | **364/373** |
| Linhas publicadas sem `sala_id` | **144/373** |
| Das 364 sem professor, com vínculo direto único em `turma_disciplinas` | 33 |
| Das 364 sem professor, sem vínculo direto de professor nessa tabela | 331 |
| Referências publicadas ausentes (slot, disciplina, professor, sala) | 0 |
| Divergências de escola entre quadro e slot | 0 |
| Divergências turma entre quadro e versão | 0 |
| Turmas com mais de uma versão publicada | 0 |
| Colisões detectadas entre turmas publicadas, mesma escola/ano e intervalos sobrepostos (professor ou sala explicitamente registados) | 0 |
| Aulas publicadas alocadas a slots marcados como intervalo | **2** |
| Dias configurados | Segunda a sexta (1–5) |

**Limites de interpretação:** a ausência de professor/sala na linha de horário não demonstra ausência de vínculo docente ou sala-base da turma; também não autoriza preencher esses campos silenciosamente. O número de colisões considera apenas professores e salas explicitamente identificados, não exclui conflitos invisíveis por `NULL`. Os 33 vínculos únicos acima foram verificados apenas na associação direta `turma_disciplinas`, não são prova suficiente para corrigir automaticamente os quadros. A contagem de anos ativos usa `anos_letivos.ativo`.

## Achados e ações propostas

### H-001 — P0 — Leitura canónica completa e escopo

`/api/escolas/[id]/horarios/quadro` devolve `quadro_horarios` com `applyKf2ListInvariants(defaultLimit: 50)`; `/api/escolas/[id]/horarios/slots` também limita por omissão a 50, apesar de existirem 122 slots no banco. O hook `useHorarioData.ts` e `TurmaHorarioModal.tsx` consomem os endpoints. A integração deve **paginar exaustivamente**, sem carregar 50 registos como se fossem a lista completa, ou fornecer projeção agregada dedicada com limites explícitos, ordenação estável e sinal de parcialidade. Respeitar escola, turma, ano letivo, turno e versão. Não reutilizar diretamente endpoints de escrita para leituras de papéis com acesso só de visualização.

**Aceite:** horários completos >50 aulas/slots, vários turnos com mesma `ordem`, escolas distintas, ano atual/histórico; nenhuma mistura de slots de turnos nem ocultação silenciosa de resultados.

### H-002 — P0 — Preservar versão publicada e isolamento

A leitura do quadro já escolhe a última versão publicada quando não recebe `versao_id`. O explorador deve obter o estado explicitamente e confirmar a correspondência `escola_id/turma_id/ano_letivo_id` antes de expor detalhes. `versao_id` fornecido pelo cliente não é prova de autorização. As rotas de gestão atuais exigem `authorizePedagogicalManage` ou `authorizeTurmasManage`, mais restritivas que a leitura esperada de Secretaria/Direção. Criar contrato de leitura separado ou ajustar a autorização sem conceder escrita.

**Aceite:** draft/arquivada não aparecem como oficiais; nenhuma leitura entre escolas ou anos não autorizados; papel só de leitura funciona sem acesso a POST/DELETE; retorno parcial e falha são distinguíveis de ausência de horário.

### H-003 — P0 — Consistência de docente

`ProfessorContextView` **já apresenta** horários publicados. O endpoint `command-center/professores/[professorId]` filtra `quadro_horarios.professor_id` e verifica `horario_versoes.status='publicada'`. Com 364/373 aulas publicadas sem `professor_id`, a agenda pode estar vazia mesmo havendo atribuições docentes. **Não duplicar o widget nem inferir que o professor está desvinculado.**

**Aceite:** distinguir “sem horário publicado identificado para este docente” de “sem atribuição”; identificar aulas publicadas sem docente como pendência de dados; resolver apenas vínculos comprovadamente canónicos e inequívocos, sem mutação automática; testar perfil ausente/excluído e resultados parciais.

### H-004 — P1 — Turma: primeira projeção visual

`TurmaContextView` apresenta disciplinas/professores, mas não uma grelha oficial de horários. Adicionar secção compacta e **somente leitura**, com dia, início–fim, disciplina, docente (quando registado), sala (quando registada), versão publicada e link para gestão/PDF existente. Se não houver versão publicada: “Horário ainda não publicado”, nunca grelha falsa. Em ano histórico: sinalizar o ano, sem oferecer edição.

**Aceite:** mesmo horário do módulo e do portal do aluno; ausência de docente/sala não esconde a aula; não editar no explorador; horário não bloqueia o restante contexto.

### H-005 — P1 — Professor: consolidar, não recriar

Reutilizar `ProfessorContextView` e a sua API; adicionar agrupamento por dia e aviso de cobertura incompleta, mantendo distinção entre vínculos e aulas. O portal docente `/api/professor/turmas/[id]/horario` é por turma e exige associação; não é API geral do explorador de professor.

**Aceite:** apenas aulas oficialmente publicadas, filtro de ano, dados ausentes explícitos, sem atribuições inventadas, sem regressão de permissões.

### H-006 — P2 — Curso, Classe, Disciplina: agregações derivadas

- **Curso:** cobertura de turmas com horário publicado / total elegível no ano, atalho às turmas sem horário; não inventar um “horário do curso”.
- **Classe:** mesma cobertura por turma/turno; nunca misturar turnos, versões históricas ou cursos.
- **Disciplina:** em quais turmas e slots publicados ocorre, com professor/sala quando disponíveis; não confundir presença em `curso_matriz` com aula programada.

**Aceite:** contagens consistentes com a projeção de Turma, consultas paginadas e autorização herdada da escola/ano.

### H-007 — P1 — Intervalos e validação de publicação

Há **2 aulas publicadas associadas a slots `is_intervalo=true`**. Auditar as regras e a integridade da publicação, sem editar registos diretamente nesta frente. UI não deve converter intervalo em aula normal sem alerta. A função `mapSlots` agrupa por `ordem` e a chave `${dia}-${ordem}` pode colidir entre turnos.

**Aceite:** bloqueio de novas publicações em intervalos, cobertura de turnos sobrepostos, regressões com slots por dia e ano; eventual reparação de dados exige evidência e operação separada.

### H-008 — P1 — GET de versão sem efeitos colaterais

`/api/secretaria/turmas/[id]/horario/versao` **insere draft num GET** quando não encontra um. O explorador não deve invocar esse GET para consultar estado. Separar “consultar versão” (GET puro) de “criar rascunho” (POST autorizado e explícito) antes de reutilizar o fluxo.

**Aceite:** 100 GETs não criam versões, não atualizam timestamps e não alteram o banco; POST continua idempotente sob concorrência.

## Sequência recomendada

1. **H-001, H-002, H-008:** contratos de leitura sem truncamento, autorização e GET sem escrita.
2. **H-007, H-003:** integridade dos intervalos, cobertura de docente e estados incompletos.
3. **H-004, H-005:** Turma primeiro; Professor reaproveitando o explorador já existente.
4. **H-006:** Curso/Classe/Disciplina com agregações derivadas da mesma fonte.
5. Regressões de permissões, anos históricos, escolas, turnos, >50 slots/aulas, PDF, portais e homologação autenticada antes de integração/deploy.

## Referências

- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`
- `apps/web/src/app/api/escolas/[id]/horarios/slots/route.ts`
- `apps/web/src/app/api/secretaria/turmas/[id]/horario/versao/route.ts`
- `apps/web/src/app/api/escolas/[id]/command-center/professores/[professorId]/route.ts`
- `apps/web/src/components/secretaria/command-center/ProfessorContextView.tsx`
- `apps/web/src/components/secretaria/command-center/TurmaContextView.tsx`
- `apps/web/src/hooks/useHorarioData.ts`
- `apps/web/src/components/secretaria/TurmaHorarioModal.tsx`
- `apps/web/src/app/api/aluno/horario/route.ts`
- `apps/web/src/app/api/professor/turmas/[id]/horario/route.ts`

**Escopo desta PR:** documentação da auditoria; sem alterações em APIs, migrations, UI ou produção. As frentes EX-007–EX-010 da PR #262 permanecem independentes.
