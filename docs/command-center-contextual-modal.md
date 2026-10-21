# KLASSE — Command Center: Modal de Visões Contextuais

**Especificação oficial de produto e engenharia · v1.0 · 21/10/2026**

| Propriedade | Definição |
| --- | --- |
| Status | **Especificação aprovada como base de trabalho; funcionalidade em desenvolvimento** |
| Implementação | `feat/command-center-contextual-modal-foundation-20261021` |
| Origem | [Auditoria e plano — Issue #224](https://github.com/moxi-edtech/moxi-edtech/issues/224) |
| Referência de pesquisa | [Global Search — roadmap](./global-search-roadmap.md) |
| Publicação | **Não homologada e não publicada por este documento** |

> **Convenção do roadmap:** `[x]` = implementação **identificada no código desta branch** ou decisão tomada, **não** significa teste passado, aplicação da migração, merge ou deploy. `[ ]` = trabalho, verificação ou homologação pendente. Uma fase só é concluída quando passar no respetivo gate.

## 1. Visão, limites e experiência pretendida

O Command Center é a **entrada única para pesquisar, explorar e agir**. Em vez de criar um painel paralelo, estendemos o `CommandPalette` existente: o utilizador escreve, seleciona uma entidade, e o mesmo modal abre a respetiva visão contextual. A pesquisa continua acessível por clique ou **Ctrl/Cmd+K**. O utilizador deve conseguir seguir o contexto sem perder escola, ano letivo ou informação já digitada.

**Princípios:**

1. **Pesquisa → contexto → ação**, sem navegação desnecessária.
2. **Modal único** para pesquisa e exploração; não introduzir outro Command Center ou modais aninhados.
3. **Curso → Classe → Turma → Aluno** é a trajetória-alvo. O aluno mantém a integração com o **Balcão existente**, não uma ficha concorrente.
4. **Indicadores corretos e verificáveis**, agregados no PostgreSQL; proibir contagem a partir de listas limitadas ou números fixos.
5. **Menor privilégio:** ser encontrado na pesquisa não confere autorização para detalhes, notas, documentos ou dados financeiros.
6. **UX contida:** espaço, legibilidade, transições curtas, foco/teclado, sem painéis decorativos ou animações complexas.
7. **Preservar a experiência atual** da Topbar, Command Palette, Balcão e ações escolares.

**Definição de entrega:** contrato de dados correto, autorização no endpoint e no Supabase, estados completos, testes unitários + DB/RLS + E2E autenticados, CI verde e homologação. Commit isolado não conta como conclusão.

## 2. Arquitetura e inventário da implementação

~~~text
Topbar / Ctrl+K
    │
    ▼
CommandPalette (cmdk + diálogo acessível)
    ├── useGlobalSearch ──► search_global_entities (Supabase)
    ├── Aluno ────────────► Balcão atual / página canónica
    ├── Outras entidades ─► visão contextual autorizada ou fallback
    └── Curso ────────────► CourseContextView
                                 │
                          useCourseContext (TanStack Query)
                                 │
                          GET /api/escolas/:id/command-center/cursos/:cursoId
                                 │
                    Auth → Escola → Papel → Ano letivo
                                 │
                      command_center_course_overview (RPC)
~~~

| Camada | Fonte de verdade | Estado na branch |
| --- | --- | --- |
| Pesquisa e modal | `apps/web/src/components/CommandPalette.tsx` | Modal de pesquisa estendido |
| Pesquisa global | `apps/web/src/hooks/useGlobalSearch.ts` | Já existe; RPC, debounce, cache e recentes |
| Contexto da entidade | `apps/web/src/lib/command-center/entity-context.ts` | Tipado para curso, classe, turma e professor |
| Visão do curso | `apps/web/src/components/secretaria/command-center/CourseContextView.tsx` | KPIs, classes, turmas e breadcrumb inicial |
| Consulta/caching | `apps/web/src/hooks/useCourseContext.ts` | TanStack Query v5 |
| API | `apps/web/src/app/api/escolas/[id]/command-center/cursos/[cursoId]/route.ts` | GET académico de leitura |
| Agregação | `supabase/migrations/20271015100000_command_center_course_overview.sql` | Migração versionada, **não homologada** |
| Modal de turma | `TurmaContextView.tsx` + `useTurmaContext.ts` | Implementação na branch; homologação autenticada pendente |
| Modal próprio de classe ou professor | Ainda não existente | Fallback na pesquisa |
| Histórico/deep links do modal | Ainda não existente | Roadmap |

**Constatação sobre o Supabase ligado (21/10/2026):** a RPC `command_center_course_overview` **não constava** no banco consultado. A rota poderá devolver **503** até ser instalada e testada no ambiente correto. A migração presente na branch não equivale a migração aplicada.

## 3. Estados oficiais do modal

| Estado | O que aparece | Transições e comportamento |
| --- | --- | --- |
| `closed` | Nada; página atual intacta | Topbar ou Cmd/Ctrl+K abre o modal |
| `search.idle` | Campo vazio, ações frequentes e recentes | Escrever → `search.loading`; selecionar recente → detalhe autorizado |
| `search.loading` | Termo digitado, indicador discreto | Debounce; continuar a escrever cancela/torna obsoleta a busca anterior |
| `search.results` | Resultados identificados por tipo, nome e informação auxiliar | Enter/clique seleciona; setas navegam sem ações aninhadas |
| `search.empty` | Sem correspondências no escopo | Corrigir ou limpar termo; não inventar resultados |
| `search.error` | Falha de pesquisa, texto preservado | Retry explícito **a completar** |
| `context.loading` | Título da entidade e estado de leitura | Consulta autorizada; cancelamento ao fechar/trocar |
| `context.ready` | KPIs e dados permitidos | Selecionar classe/turma ou aceder a ação canónica |
| `context.empty` | Entidade válida sem dados no ano | Zero só quando comprovado, distinguindo vazio de erro |
| `context.error` | Rede/RPC/contexto indisponível | Mensagem + retry; **nunca** inventar KPIs |
| `context.forbidden` | Falha 401/403 | Não mostrar dados parciais nem cache de outra sessão |
| `context.refreshing` | Revalidação de dados visíveis | Indicação discreta; sem flicker nem troca de contexto (pendente) |
| `context.fallback` | Tipo ainda sem visão própria | Identificação, voltar à pesquisa e página existente |

**Regra de fecho:** Escape, clique fora ou botão de fechar encerram o modal, limpando seleção/contexto e cache privada. Abertura posterior começa pela pesquisa. **Voltar à pesquisa** conserva o termo, resultados e intenção da pesquisa atual enquanto o diálogo continua aberto.

**Teclado/acessibilidade:** foco inicial no campo, `↑↓` e Enter, Escape previsível, foco devolvido ao disparador, `aria-label`, `aria-live` para carregamento, contraste, mobile e `prefers-reduced-motion`. Os comportamentos são requisitos de homologação, não testes já comprovados.

**Sessão:** mudança de escola, ano, portal ou utilizador nunca pode mostrar payload anterior. A branch limpa o cache do `QueryClient` ao fechar ou mudar escola/portal; logout/login e recentes da pesquisa ainda precisam de auditoria.

## 4. Percurso Curso → Classe → Turma → Aluno

### 4.1 Curso — visão inicial

Selecionar `curso` no resultado de Admin ou Operações cria contexto contendo `id`, `escolaId` e `academicYearId`. O modal expande-se e solicita o overview académico:

- Nome, código, nível, descrição, estado e ano letivo.
- **Indicadores**: classes, turmas ativas e alunos matriculados no escopo.
- Classes com número de turmas/alunos; turmas com nome, turno, capacidade e alunos.
- Estados de carregamento, ausência de dados, falha e lista parcial.
- **Sem indicadores financeiros na primeira versão**.

A visão de curso existe na branch; exatidão das contagens e integração autenticada continuam por homologar.

### 4.2 Classe — seleção no mesmo modal

Selecionar uma classe mantém curso e ano, filtra turmas, atualiza breadcrumb `Curso › Classe` e permite alternar sem nova pesquisa. **Hoje a filtragem é local** na lista recebida do curso (até 100 turmas). Se turmas da classe estiverem fora do lote, **não concluir que a classe está vazia**. A vista e a paginação dedicadas de classe são futuras.

### 4.3 Turma — resumo e ação

Selecionar turma a partir do curso abre a **visão contextual dedicada de turma** no mesmo modal, preservando o ano letivo e permitindo voltar ao curso. A vista mostra alunos matriculados **paginados em blocos de 20**, contagem exata das matrículas elegíveis, turno, capacidade, sala, disciplinas e professores vinculados. Selecionar aluno encaminha para a integração existente do Balcão, ou navegação canónica nos portais sem Balcão; há alternativa explícita para abrir a página da turma. **A conclusão depende de CI verde, testes DB/RLS e homologação autenticada.**

### 4.4 Aluno — manter o Balcão

A trajetória-alvo termina no aluno, mas o **Balcão é o workspace operacional existente**. A navegação deve abrir o aluno em contexto, com confirmação quando houver trabalho não guardado; não deve criar segundo perfil ou duplicar operações. Dados financeiros, notas e documentos só aparecem com as regras e permissões já exigidas por esses domínios.

### 4.5 Navegação futura / deep links

**Estado atual:** `classeId` e `turmaId` são locais ao `CourseContextView`; o Back/Forward do navegador **não** reproduz o percurso. **Contrato-alvo:** serializar tipo/id da entidade, escola, ano e contexto pai em URL ou estado navegável; validar tudo no servidor ao restaurar; regresso por breadcrumb, seleção de outra entidade e refresh sem contexto incorreto. Não introduzir URL pública que contorne autorização.

~~~text
Pesquisa → Curso → Classe → Turma → Aluno/Balcão
  ▲         ▲       ▲        │
  └── voltar à pesquisa     └── página canónica quando necessário
~~~

## 5. Contratos técnicos

### 5.1 Pesquisa

**RPC existente:**

~~~text
public.search_global_entities(
  p_escola_id, p_query, p_types, p_limit,
  p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id
)
~~~

Campos consumidos: `id`, `type`, `label`, `highlight`, `score`, `updated_at`, `created_at`. O frontend associa `href`, intenção (`financeiro|academico|perfil|documentos`) e ações aplicáveis. `useGlobalSearch` seleciona os tipos conforme portal. **Resultados da pesquisa não são autorização para ler detalhes**.

### 5.2 Contrato da entidade

~~~ts
type ContextualEntityType = "curso" | "classe" | "turma" | "professor";

type EntityContext = Readonly<{
  type: ContextualEntityType;
  id: string;
  escolaId: string;
  label: string;
  academicYearId: string | null;
}>;
~~~

`label` e `href` são apresentação/navegação, **nunca** fonte de permissão. A inclusão de outros tipos no union requer visão real e gate correspondente.

### 5.3 Endpoint de curso (implementado no código)

~~~http
GET /api/escolas/{escolaId}/command-center/cursos/{cursoId}?ano_letivo_id={uuid}
~~~

Parâmetros: `cursoId` UUID obrigatório; `ano_letivo_id` UUID opcional (resolvido para ano ativo quando ausente). Ano histórico válido usa modo `READ`. Fluxo da rota:

1. `createRouteClient()` + `auth.getUser()` — sessão autenticada.
2. `resolveEscolaIdForUser` — escola permitida.
3. `requireRoleInSchool({ productContext: "k12", roles: [...] })` — whitelist de papéis.
4. `resolveAcademicYearScope(..., operation: "READ")` — escola e ano.
5. RPC `command_center_course_overview`.
6. Resposta privada `Cache-Control: private, no-store`.

**Sucesso — contrato atual:**

~~~ts
type CourseOverview = {
  curso: {
    id: string; nome: string; codigo: string | null;
    nivel: string | null; descricao: string | null; status: string | null;
  };
  anoLetivo: { id: string; ano: number; ativo: boolean };
  stats: { classes: number; turmas: number; alunos: number };
  classes: Array<{ id: string; nome: string; turmas: number; alunos: number }>;
  turmas: Array<{
    id: string; nome: string; classeId: string | null;
    turno: string | null; capacidade: number | null; alunos: number;
  }>;
  turmasLimitadas: boolean;
};
type Success = { ok: true; data: CourseOverview };
type ErrorReply = { ok?: false; error: string; reason?: string };
~~~

A rota de autorização pode devolver um JSON de erro próprio sem `ok:false`; o frontend tem de respeitar **HTTP status**.

| Status | Significado | UX obrigatória |
| --- | --- | --- |
| `200` | Leitura válida | Mostrar dados da entidade/ano corretos |
| `400` | Parâmetros inválidos | Sem retry automático |
| `401` | Sessão ausente | Limpar dados privados; autenticação |
| `403` | Escola/papel não autorizado | Ocultar dados; não fazer fallback inseguro |
| `404` | Curso/ano fora do escopo ou inexistente | “Não encontrado”; não substituir por zero |
| `409` | Contexto de ano ativo sem configuração | Mostrar erro de configuração |
| `503` | RPC ou contexto indisponível | Mensagem e retry manual |
| `500` | Falha não prevista | Erro controlado e observabilidade |

### 5.4 Contrato Supabase — RPC de curso

~~~sql
public.command_center_course_overview(
  p_escola_id uuid, p_curso_id uuid, p_ano_letivo_id uuid
) returns jsonb
~~~

A migration na branch usa `STABLE SECURITY INVOKER` e valida `auth.uid`, acesso à escola e papel dentro da função, além do gate da API. Restringe `EXECUTE` de `PUBLIC/anon` e concede a `authenticated/service_role`. **A instalação, RLS, grants e contagens reais estão pendentes de testes**.

**Invariantes obrigatórias:**

- Entidade e ano pertencem à mesma escola; jamais admitir consulta cruzada manipulando IDs.
- Somente classes/turmas válidas do curso e ano; contemplar vínculos legados apenas com regra explícita.
- `alunos` é contagem **distinta**, com matrícula vigente e pessoa não eliminada; transferências, cancelamentos e rematrículas não podem duplicar ou aumentar indevidamente o total.
- Agregados vêm do banco e são **independentes da lista de até 100 turmas**. `turmasLimitadas=true` exige UX de paginação.
- Histórico exige contrato próprio de status e leitura; o uso de `status = "ativo"` na migration é **hipótese a validar**, não verdade certificada.
- Falha de read model nunca deve retornar `200` com zeros fictícios.
- Não misturar valores emitidos, pagos, cancelados, vencidos ou em dívida; **sem financeiro até nova autorização**.

### 5.5 APIs propostas para próximas entidades (não implementadas)

| Rota proposta | Conteúdo | Proteção |
| --- | --- | --- |
| `GET /api/escolas/:id/command-center/classes/:classeId` | Classe e turmas paginadas no ano | Académica |
| **Implementado na branch:** `GET /api/escolas/:id/command-center/turmas/:turmaId?page=N&ano_letivo_id=UUID` | Turma, disciplinas, professores e alunos paginados (20), contagem exata e `hasMore` | Académica; autorização por papel/escola/ano |
| Eventual rota de alunos separada | Páginas por cursor, caso offset deixe de escalar | Reavaliar sob métricas, sem duplicar endpoint |
| `GET /api/escolas/:id/command-center/professores/:professorId` | Alocações, turmas, carga | Académica |
| `GET /api/escolas/:id/command-center/disciplinas/:disciplinaId` | Matriz/curso, turmas, docentes | Académica |
| `GET /api/escolas/:id/command-center/financeiro/...` | Métricas de cobrança por competência | **Gate financeiro distinto** |

Cada rota futura deve ter schema de entrada, ano, escola, papel, RLS, colunas mínimas, paginação, erros e testes diretos de manipulação de IDs.

### 5.6 Contrato do explorador de turmas (implementado na branch, ainda não homologado)

```http
GET /api/escolas/{escolaId}/command-center/turmas/{turmaId}?ano_letivo_id={uuid}&page=1
```

- Autenticar utilizador, resolver escola, aplicar o gate K12, resolver ano letivo em modo `READ`; confirmar que a turma pertence à mesma escola/ano.
- `page`: inteiro entre 1 e 10000; `pageSize`: 20 fixo no servidor. O frontend não escolhe a dimensão da página.
- `data.turma`: `id,nome,turno,sala,classe,curso,capacidade,anoLetivo`.
- `data.alunos`: `items[{id,nome,numeroChamada}],total,page,pageSize,hasMore`. Consulta `matriculas` e alunos por `!inner` sob escola/ano, com `count:exact`; filtra pessoas eliminadas, transferências/cancelamentos e contém apenas nomes/número de chamada.
- `data.disciplinas`: `[{id,nome,professores:string[]}]`; `professores:string[]`; `disciplinasLimitadas:boolean` sinaliza limites nas vinculações, com fallback à página canónica.
- Ano ativo: apenas matrícula `ativo` com flag `ativo=true`; ano encerrado: estados `ativo|concluido`, sem transferidos. Estes estados e o comportamento de RLS exigem homologação com dados históricos.
- Respostas privadas e sem dados financeiros/notas/BI; 401/403/404 não devem ser repetidos automaticamente pelo `useTurmaContext`.
- `turmaContextQueryKey`: `["command-center","turma",escolaId,turmaId,academicYearId,page]`; stale 30s, cache inativa 120s, cancelamento via AbortSignal e limpeza pelo modal.
- Testar consulta direta por ID de outra escola, ano inexistente, utilizador sem papel, sessão encerrada, professor de outra escola e paginação acima de 50/100; a interface nunca deve transformar erro em lista vazia.

**Nota de engenharia:** a versão atual usa paginação por offset e join PostgREST; só declarar “concluído” quando a coerência dos totais e a consulta do professor/disciplinas forem verificadas num ambiente autenticado. Para conjuntos muito grandes, avaliar paginação por cursor.

## 6. TanStack Query, cache, invalidação e Motion

O hook `useCourseContext` está na branch e utiliza este contrato:

~~~ts
const queryKey = [
  "command-center", "curso",
  context.escolaId, context.id, context.academicYearId
];

useQuery({
  queryKey,
  queryFn: ({ signal }) => fetch(courseUrl, {
    credentials: "same-origin", cache: "no-store", signal
  }),
  staleTime: 45_000,
  gcTime: 120_000,
  retry: 1,
  refetchOnWindowFocus: false
});
~~~

**Significados:** `staleTime=45s` permite reuso fresco enquanto o modal está ativo; `gcTime=120s` gere o descarte de queries inativas, não assegura dados atualizados. `AbortSignal` cancela requests obsoletos. O `QueryClientProvider` pertence ao `CommandPalette`, não a uma cache persistida; **fecho do modal, troca de escola e portal limpam o cache**. O hook devolve `data`, `error`, `loading`, `refreshing` e `retry`.

**Ainda a implementar ou testar:**

- Retry apenas para falhas transitórias; **401/403/404 não devem repetir automaticamente**.
- Invalidação após matrícula, transferência, rematrícula, alteração de curso/turma, mudança de ano.
- Limpeza por troca de utilizador no mesmo navegador, inclusive login/logout e pesquisa recente.
- Renderização segura de `refreshing`, sem mostrar dados de outra escola/ano.
- Contratos de queryKey para classe, turma, professor e disciplina.
- Performance p50/p95 real — **não declarar SLA atingido sem medição**.

**Cache distinto de pesquisa:** `useGlobalSearch` mantém cache em memória (TTL de pesquisa) e **resultados recentes em `localStorage` segmentados por escola/portal, não por utilizador**. Isto é dívida de privacidade: restringir/limpar na troca de sessão e não persistir informação pessoal desnecessária.

**Motion:** `AnimatePresence`, `motion` e `useReducedMotion` já estão presentes na branch; usar transições de ~120–170 ms entre pesquisa/contexto e seleção de turma. A animação nunca deve atrasar carregamento ou movimentar foco inesperadamente.

## 7. Pesquisa: todas as entidades e portais

**Matriz retirada do código `PORTAL_TYPES` do `useGlobalSearch`**. Ser pesquisável **não significa** ter um modal próprio nem permissão para ler todos os campos.

| Portal | Tipos pesquisáveis hoje |
| --- | --- |
| **Secretaria** | `aluno`, `matricula`, `turma`, `documento`, `candidatura` |
| **Financeiro** | `aluno`, `mensalidade`, `pagamento`, `recibo` |
| **Admin** | `turma`, `professor`, `classe`, `curso`, `usuario` |
| **Operações** | `aluno`, `matricula`, `turma`, `documento`, `candidatura`, `professor`, `classe`, `curso`, `usuario` |
| **Professor** | `aluno` |
| **Aluno** | `aluno` |
| **Gestor** | `aluno` |
| **Superadmin** | `usuario` |

O modal contextual atualmente tenta abrir `curso|classe|turma|professor` nos portais `admin|operacoes|secretaria`. Contudo, **a pesquisa da Secretaria ainda não oferece curso/classe/professor por padrão**. Qualquer alteração nessa cobertura deve passar pela revisão de permissões.

### 7.1 Catálogo de evolução por entidade

| Entidade | Pesquisa hoje | Modal próprio hoje | Evolução |
| --- | --- | --- | --- |
| **Curso** | Admin / Operações | **Vista inicial na branch** | Indicadores validados, classes/turmas completas, acesso a alunos |
| **Classe** | Admin / Operações | Fallback | Turmas, vagas, matrícula, disciplinas, indicadores |
| **Turma** | Secretaria / Admin / Operações | **Vista dedicada na branch** | Homologar alunos paginados, docentes, disciplinas e ligação ao Balcão |
| **Professor** | Admin / Operações | Fallback | Turmas, disciplinas, carga, alocações por ano |
| **Aluno** | Secretaria / Financeiro / Operações / Professor / Aluno / Gestor | **Balcão existente**, conforme portal | Entrada contextual sem duplicar atendimento |
| **Matrícula** | Secretaria / Operações | Navegação canónica | Estado, turma, ano e histórico corrigível |
| **Documento** | Secretaria / Operações | Navegação canónica | Tipo, validade, descarga autorizada |
| **Candidatura** | Secretaria / Operações | Navegação canónica | Protocolo, estado e ações autorizadas |
| **Mensalidade** | Financeiro | Navegação canónica | Competência, estado, pagamentos e dívida |
| **Pagamento** | Financeiro | Navegação canónica | Método, estado, conciliação, recibo |
| **Recibo** | Financeiro | Navegação canónica | Documento fiscal e ações permitidas |
| **Utilizador** | Admin / Operações / Superadmin | Navegação canónica | Papel, vínculo, escola e gestão autorizada |
| **Disciplina** | **Ainda não pesquisável** | Não | Currículo, turmas, docentes, resultados |
| **Avaliação / pauta** | **Ainda não pesquisável** | Não | Publicação, notas e períodos |
| **Ano letivo / período** | **Ainda não pesquisável** | Não | Navegação temporal, leitura histórica |
| **Sala / instalação** | **Ainda não pesquisável** | Não | Ocupação e alocação, se existir modelo consolidado |
| **Cobrança / dívida** | **Não é tipo autónomo** | Não | Financeiro por competência e permissão |

**Critérios para adicionar tipo:** problema concreto, fonte de dados estável, pesquisa indexada, endpoint com gate, dados mínimos, navegação/fallback, estado vazio, testes cross-tenant. Prioridade após curso: **Classe → Turma → Professor → Disciplina**. O aluno mantém o Balcão; financeiro tem trilha própria.

## 8. Segurança: fronteiras de autorização

### 8.1 Fluxo de confiança

~~~text
UI/resultado de pesquisa (não confiável)
   → endpoint HTTP autenticado
   → resolver escola + ano letivo
   → capacidade/papel apropriado
   → RLS e gate interno na RPC
   → payload mínimo, sem exposição fora do escopo
~~~

O GET de curso na branch exige sessão, escola e `requireRoleInSchool` com `productContext:"k12"` e papéis: `admin`, `admin_escola`, `staff_admin`, `diretor`, `secretaria`, `admin_secretaria`, `secretaria_financeiro`, `admin_financeiro`. A migration repete o gate no banco. **Esta lista não autoriza automaticamente ver dados financeiros, pessoais ou notas.**

| Domínio | Regra |
| --- | --- |
| Identificação académica básica | Tenant e ano, papel e relação autorizados |
| Aluno, matrícula, documentos | Permissão académica e minimização de dados pessoais |
| Notas, avaliações, boletim | Acesso pedagógico, estado de publicação e regras de taxa |
| Propinas, saldos, dívida, recibos | **Capacidade financeira dedicada** e read models próprios |
| Professores | Turmas e disciplinas por vínculo; ocultar dados pessoais dispensáveis |
| Utilizadores | Permissão administrativa dedicada |
| Ano letivo histórico | Leitura histórica explícita; nunca escrita implícita |
| Ações | Autorização própria a cada operação; nunca depender só do botão oculto |

**Obrigatório antes da entrega:** testar sessão anónima, escola A/B, troca de role, IDs arbitrários, dois anos letivos, logout/login sem troca de escola, consulta direta ao REST/RPC, `SECURITY INVOKER`/RLS e grants. `service_role` jamais no frontend; não confiar em `user_metadata`.

**Supabase conectado, inspeção em 21/10/2026:** `search_global_entities`, `user_has_role_in_school` e `has_access_to_escola_fast` foram encontradas com `EXECUTE` a `anon` negado; `command_center_course_overview` não estava instalada. Isto **não** é teste completo de isolamento/RLS.

## 9. Roadmap oficial — checklist de execução

**Como marcar:** subitem `[x]` apenas com artefacto verificável na branch. Para concluir uma fase, anexar PR, SHA, logs de teste/CI, homologação e confirmação do gate. Atualizar este ficheiro na mesma PR da entrega.

### Fase 0 — Decisões e auditoria
- [x] Auditar Command Center, pesquisa e modelos académicos (issue #224).
- [x] Escolher modal único com `cmdk`, sem novo painel.
- [x] Criar branch de trabalho a partir da `main`.
- [x] Publicar esta especificação oficial com matriz de entidades e roadmap.
- [ ] Validar contratos de matrícula, transferência, status e ano histórico.
- [ ] Aprovar matriz de capacidades por papel e domínio.

**Gate:** arquitetura e autorização acordadas.

### Fase 1 — Modal e fluxo de pesquisa
- [x] Estender `CommandPalette`, mantendo Topbar e `Ctrl/Cmd+K`.
- [x] Criar `EntityContext` e fallback para classe/turma/professor.
- [x] Seleção contextual de curso com retorno à pesquisa.
- [x] Manter encaminhamento existente de aluno/Balcão.
- [x] Adicionar transição discreta com reduced motion.
- [ ] Testar teclado, foco, Escape, mobile, leitor de ecrã e seleção múltipla.
- [ ] Implementar UX completa de falhas na pesquisa e fallback estável.
- [ ] Validar troca de aluno com trabalho não guardado.

**Gate:** pesquisa e Balcão sem regressão.

### Fase 2 — API, Supabase e correção de indicadores
- [x] Criar rota GET de overview do curso no código.
- [x] Versionar a migration da RPC de contagem académica.
- [x] Incluir gates HTTP e SQL de acesso/escola/papel/ano.
- [ ] Rever SQL com o contrato canónico de matrículas e histórico.
- [ ] Aplicar e testar a migration **em homologação**, nunca diretamente em produção.
- [ ] Testar >50 alunos e >100 turmas; cancelamentos, transferências e re-matrículas.
- [ ] Confirmar ano letivo histórico, classes legadas, idempotência das contagens.
- [ ] Testar PII/roles/escola A→B/ano A→B, REST/RPC diretos.
- [ ] Analisar planos SQL e índices; provar precisão sem truncamento.

**Gate:** valores corretos e isolamento validado no banco.

### Fase 3 — TanStack Query e performance
- [x] Adicionar TanStack Query v5 e lockfile na branch.
- [x] Criar `useCourseContext` com queryKey por escola/curso/ano.
- [x] Criar QueryClient local, limpar no fecho e na troca escola/portal.
- [x] Adotar retry limitado, abort e cache de curta duração (valores iniciais).
- [ ] Rodar instalação congelada, TypeScript, lint, build e testes.
- [ ] Ajustar retry por HTTP status e impedir cache 401/403.
- [ ] Invalidar ao matricular/transferir/rematricular e trocar ano.
- [ ] Limpar recentes sensíveis ao trocar utilizador/logout.
- [ ] Medir p50/p95 sob escala real e validar revalidação visual.

**Gate:** sem vazamento/cross-session, sem stale incorreto, desempenho medido.

### Fase 4 — Exploração Curso → Classe → Turma → Aluno
- [x] Exibir KPIs, classes, turmas e limites da lista no modal de curso.
- [x] Filtrar turmas por classe no modal e mostrar breadcrumb.
- [x] Mostrar resumo de turma e abrir página canónica.
- [ ] Paginação dinâmica de turmas fora dos 100 primeiros registos.
- [ ] Criar visão/endpoint dedicado de classe.
- [x] Criar visão/endpoint dedicado de turma (código na branch; homologação pendente).
- [x] Carregar alunos paginados (20 por página) e ligar a seleção de aluno ao Balcão existente, quando disponível.
- [x] Mostrar disciplinas/professores do vínculo académico sem valores financeiros ou BI.
- [ ] Testar turmas com 0, 1, 20, 21, 50+ e 100+ matrículas e respetivos estados.
- [ ] Homologar disciplina/professor em vínculos regulares e legados, com professores de outras escolas excluídos.
- [ ] Restaurar navegação/back/forward com deep link autorizado.
- [ ] E2E do percurso completo sem perda de escola/ano.

**Gate:** exploração sem falsas listas vazias nem paginação enganosa.

### Fase 5 — Professor, disciplina e pedagogia
- [ ] Validar vínculos professor ↔ disciplina ↔ turma ↔ ano.
- [ ] Criar vista dedicada de professor e alocações.
- [ ] Adicionar disciplina à pesquisa **só** com indexação e gate.
- [ ] Criar visão de disciplina/turmas/carga curricular.
- [ ] Integrar notas e avaliações apenas dentro das regras de publicação/permissão.
- [ ] Testar professor com múltiplas escolas e anos.

**Gate:** dados pedagógicos autorizados.

### Fase 6 — Restantes entidades e finanças
- [ ] Matrícula e candidatura: estados e ações autorizadas.
- [ ] Documento: validade e acesso seguro a ficheiros.
- [ ] Utilizador: vínculos e gestão autorizada.
- [ ] Mensalidade, pagamento e recibo: consultas específicas e auditoria.
- [ ] Conceituar métricas emitido/pago/parcial/cancelado/vencido/dívida.
- [ ] Implementar role/capacidade financeira **separada** da académica.
- [ ] Validar conciliação, competência e testes financeiros integrados.
- [ ] Rever possibilidade de ano letivo, avaliação, pauta e instalações como entidades.

**Gate:** cada tipo tem autorização, fonte confiável e testes.

### Fase 7 — Qualidade, segurança e entrega
- [ ] Unit tests: contratos, queryKeys, estados, retry, troca de sessão.
- [ ] DB/RLS: >50/>100, multi-tenant, anos, transferências, papéis.
- [ ] E2E autenticado desktop/mobile: pesquisar → curso → classe → turma → aluno.
- [ ] E2E Balcão, teclado/foco/Escape, mudança de aluno e logout.
- [ ] Typecheck + lint + build + suíte relevante com CI concluído e verde.
- [ ] Homologação de negócio e UX com dados representativos.
- [ ] Validar deployment SQL, grants, segurança e observabilidade sem PII.
- [ ] Abrir/revisar PR, anexar evidências e aprovar merge.
- [ ] Deploy controlado **somente quando autorizado** e smoke em produção.
- [ ] Atualizar este checklist, versão e histórico com provas.

**Gate:** CI e homologação concluídos; nenhuma tarefa pendente mascarada.

## 10. Riscos e decisões abertas

| Prioridade | Risco / diferença entre objetivo e realidade | Resolução |
| --- | --- | --- |
| P0 | RPC de curso ainda não instalada no ambiente Supabase consultado | Homologar migration e validar grants/RLS |
| P0 | Status `ativo` da migration pode excluir históricos válidos | Auditar estados canónicos, transferências e duplicados |
| P0 | Diferentes permissões para pesquisar, consultar e agir | Gates por entidade/ação e testes REST/RPC |
| P0 | Recentes em `localStorage` por escola/portal, não utilizador | Minimizar e limpar por identidade/logout |
| P1 | Vista de curso lista só até 100 turmas | Paginação server-side, não inferir vazio |
| P1 | Classe e professor ainda são fallback; turma necessita homologação | Endpoints próprios e validação do explorador de turma |
| P1 | Breadcrumb não corresponde a Back/Forward real | Contrato seguro de deep link |
| P1 | Retry automático não distingue 403 de falha transitória | Classificar status e evitar repetição inútil |
| P1 | Cache não invalidado em todas as mutações escolares | Invalidação por tenant/entidade/ano |
| P2 | Foco/acessibilidade e animações ainda não homologados | Testes E2E e reduced motion |

## 11. Governança e histórico

**Este ficheiro é a fonte de verdade para o roadmap do modal contextual.** Sempre que uma PR concluir trabalho, atualizar checklist e registar:

- Link da PR e commit.
- Escopo implementado, incluindo permissão/ano/entidade.
- Testes executados e resultado do CI (não apenas “testar depois”).
- Ambiente de homologação e resultado; release apenas após autorização.
- Decisões/contratos alterados e riscos remanescentes.

| Data | Evento | Evidência |
| --- | --- | --- |
| 21/10/2026 | Auditoria do Command Center e plano | [Issue #224](https://github.com/moxi-edtech/moxi-edtech/issues/224) |
| 21/10/2026 | Decisão: modal da pesquisa como explorador contextual | Branch `feat/command-center-contextual-modal-foundation-20261021` |
| 21/10/2026 | Fundação de curso, API, migration, TanStack Query e Motion identificados na branch | Código versionado; **testes/CI/RLS/homologação ainda não atestados** |
| 21/10/2026 | Especificação oficial ampliada e checklist por fase | Este documento |

---

**Regra final:** *Entidade pesquisável* ≠ *visão contextual pronta* ≠ *utilizador autorizado* ≠ *funcionalidade em produção*.
