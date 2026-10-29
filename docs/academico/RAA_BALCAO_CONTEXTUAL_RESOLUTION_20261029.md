# RAA ↔ Balcão — resolução no mesmo atendimento

Branch: feat/balcao-raa-contextual-resolution-20261029 (empilhada sobre a PR #296).

## Contrato
- Preservar aluno, matrícula de origem e rascunho financeiro durante a resolução.
- Mostrar apenas ações compatíveis com o bloqueio devolvido pelo RAA.
- Lançamento de notas: reutilizar EnrollmentPostActionModal e API de notas com guardas de período, escala e competência.
- Reapreciação: consultar/criar/decidir pedidos via APIs existentes; deferir não significa aprovação académica.
- Faltas: decidir justificações enviadas pelo encarregado; a aprovação não modifica frequência original nem levanta automaticamente retenção.
- Indisciplina: a direção deve documentar revisão, sem desfazer sanções silenciosamente.
- Conclusão de ciclo: ir ao separador de documentos, nunca rematricular automaticamente.
- Após cada ação, voltar à mesma ficha, reconsultar RAA e abrir rematrícula apenas se a API confirmar elegibilidade.
- Não alterar matrículas.status, historico_anos, financeiro, fiscal ou AGT para contornar bloqueios.

## Homologação necessária
1. Testar roles de secretaria/direção/professor e anos históricos.
2. Conciliar justificações aprovadas com assiduidade oficial (a API atual mantém falta original).
3. Integrar resultados de exames extraordinários/recurso à publicação oficial do resultado, sem atalhos.
4. Testar contexto do aluno, abas, rascunhos e concorrência de sessões.
5. Validar Supabase v3 da PR #296 antes de merge/deploy.

## Resultados acrescentados nesta branch
- O Balcão consulta sessões oficiais de recurso e extraordinário no ano letivo da matrícula de origem; lança uma nota por componente e aluno através do endpoint canónico. Sem sessão oficial aberta, mostra a pendência, sem simulá-la.
- A API de exames exige aluno, turma, ano de origem, componente da sessão, escala, matrícula ativa e sessão aberta/publicada. Lançamentos existentes não são substituídos: repetição idempotente da mesma nota ou conflito se houve alteração.
- As justificações formalmente aprovadas passam a deixar de contar como faltas **injustificadas** no resolvedor jurídico do decreto (somente por `frequencia_id` idêntico). A frequência original e a petição mantêm-se auditáveis e imutáveis.
- O fecho legal não pode ser alterado pela nota ou pela decisão de uma petição.
- O painel revalida a elegibilidade central após a decisão; nenhum pagamento é capturado antes de ela autorizar o destino.

## Limitações que ainda exigem homologação
- Verificar paridade exata entre o resolvedor PostgreSQL e o adaptador do decreto em TypeScript após justificações de faltas, incluindo percentuais EJA e turmas com várias disciplinas.
- Uma nota de exame `submetido` não equivale ao estado `validado` ou à pauta legal publicada. A interface não cria atalhos para essa decisão.
- Contextos históricos fechados exigem reabertura formal; a simples aprovação de pedido não reescreve histórico.
- Testes unitários e GitHub CI não substituem ensaio autenticado em banco real; dependência da PR #296 permanece.

## UI/UX contextual guiada (29/10/2026)
- Substituição do painel com formulários simultâneos por passos **Identificar → Resolver → Revalidar**. O indicador representa etapas da interface, não aprovação académica.
- Cartões representam somente evidências retornadas pelo RAA ou pedidos reais; o total e o número de decisões registadas não são inventados. Quando não existem pedidos, permanece uma orientação de bloqueio canónico.
- A ação é apresentada por contexto (justificação, recurso, sessão de exame, indisciplina, pauta, conclusão de ciclo). Uma pendência selecionada abre o seu formulário.
- Antes de qualquer escrita, há ecrã de revisão e confirmação; mensagens de confirmação distinguem **registo administrativo** de **autorização de rematrícula**.
- A interface adapta-se a móvel, usa tokens de tema light/dark e evita navegações externas. Os formulários reportam estado de rascunho ao Command Center, com proteção ao descartar entradas dentro da lista.
- Formulários continuam a usar os mesmos endpoints, idempotência e controlos de permissão, sem atualização manual de estados académicos.
- A UI da rematrícula autorizada continua exclusivamente no wizard existente. A experiência RAA bloqueada não adiciona um botão para ignorar a decisão.

### Validação não substituída
A UI pode mostrar apenas a situação prioritária que a API de rematrícula devolve nesse momento; não promete uma fila simultânea de todos os tipos de bloqueios sem evidências oficiais. A elegibilidade deve ser reconsultada após cada resolução antes de prosseguir. Homologação autenticada (mobile, roles, EJA, anos fechados) permanece obrigatória.

## Contextualização jurídica por classe e regime (PR #298)

**Fonte de verdade:** `resolveRaaProgressionForMatricula` retorna o regime académico da **matrícula de origem** e os factos de `resolveRaaDecretoEligibility`. A resposta `/api/secretaria/balcao/rematriculas/status` disponibiliza `academic.regime` e `academic.decreto` apenas como **informação de orientação**; o estado `status` e `academic.eligible` continuam exclusivos para autorização do wizard.

| Regime | Orientação contextual | Permissão de efetivar |
| --- | --- | --- |
| 6.ª | Recurso de conclusão do ensino primário / emissão documental | Só após decisão oficial e elegibilidade |
| 7.ª | Condicional com disciplinas por regularizar | Pode prosseguir se o decreto e serviço autorizam |
| 8.ª | Condicional antes da 9.ª | Bloqueia enquanto o decreto exige exame/regularização |
| 9.ª | Recurso e conclusão do I ciclo | Sem matrícula automática no próximo ciclo |
| 10.ª | Condicional e disciplinas específicas | Pode prosseguir se o decreto e serviço autorizam |
| 11.ª | Condicional antes da 12.ª | Bloqueia enquanto o decreto exige exame/regularização |
| 12.ª | Recurso e conclusão do II ciclo | Apenas documentação após conclusão |
| EJA módulos 1/2 | Classificação qualitativa e frequência anual | Depende de fonte oficial da avaliação |
| EJA módulo 3 | Conclusão qualitativa ou recurso numérico | Depende de fonte oficial e decisão do motor |
| EJA ano 1 | Condicional com exame extraordinário | Bloqueado quando o decreto exigir |
| EJA ano 2 | Recurso e conclusão | Sem conclusão automática |

A interface **não calcula notas, não avalia limites de disciplinas negativas e não interpreta combinações proibidas**. Exibe o `baseLegal`, a decisão do decreto e a orientação contextual; ausência de um resultado do decreto é representada como **não apurado**, nunca como autorização implícita. A 7.ª e 10.ª apresentam uma faixa informativa discreta na situação `READY` com condicional autorizado, sem novo CTA de cobrança/efetivação.

Para as matrículas com `regime.escala = qualitativa`, o Balcão **não oferece o lançamento de notas numéricas** como substituto de Suficiente/Não suficiente. A pauta qualitativa exige o fluxo de avaliação oficial correspondente.

### Lacunas levantadas com evidência

- **#300 — EJA qualitativo e frequência anual:** o `vw_boletim_por_matricula` expõe `nota_final numeric` e status de configuração/isenção; o `resolveDecretoDecision` atual passa apenas `notaFinal`, sem `suficiente` nem `frequenciaAnual`. A função jurídica EJA admite esses campos, mas não existem provas suficientes de integração EJA end-to-end para declarar homologação. Proibida conversão arbitrária de nota em classificação qualitativa.
- **#301 — 1.ª–5.ª classes:** o motor jurídico tipado abrange 6.ª–12.ª e EJA. O adaptador RAA devolve `null` fora desses regimes. Até definir o contrato legal, mostrar orientação conservadora e manter o bloqueio/regra oficial da API.
- **Homologação:** executar fluxos com autenticação por papel (secretaria, direção, professor), turma, classe, ano letivo e escola, incluindo registos antigos e EJA antes de publicar.

### Testes da matriz

`apps/web/tests/unit/raa-balcao-regime-guidance.spec.ts` valida a identificação de **12 regimes legais**, condicional autorizada versus bloqueada (7.ª/8.ª/10.ª/11.ª/EJA 1.º), recurso (6.ª/9.ª/12.ª), conclusão, EJA qualitativo e numérico, frequência anual, faltas trimestrais, indisciplina, falta de dados e ausência de decreto. O CI da PR também executa `raa-decreto-eligibility.spec.ts` como regressão do motor jurídico. A execução destes testes **não substitui** homologação autenticada e integração de fontes qualitativas.

## Fecho da experiência na aba Rematrícula (29/10/2026)

**Identidade académica:** `/api/secretaria/balcao/rematriculas/status` fornece `academic.source` com matrícula, turma e `session_id` da origem. Antes, o painel utilizava `dossier.aluno.matricula_id` (possivelmente já do destino). O ID efetivo do painel e a origem das notas seguem agora os dados verificados pelo servidor. Nunca usar a turma atual do dossier para um lançamento RAA na matrícula anterior.

**Operações concluídas no mesmo Balcão:**
- Justificações, decisões disciplinares, reapreciações, componentes de exames e revalidação RAA continuam no próprio painel, via endpoints autorizados.
- Notas regulares e revisão de resultados abrem o `EnrollmentPostActionModal` existente no mesmo atendimento, agora com **ano letivo e turma da matrícula de origem**. A escrita permanece sujeita ao `resolveAcademicYearContext(operation: WRITE)` e ao escritor canónico; matrícula de origem fechada e escala qualitativa não oferecem o atalho numérico.
- Documentos (gratuitos e pagos) aparecem **dentro da Rematrícula**, com emissão `checkout.emitirDocumento` ou adição ao carrinho e `CarrinhoPanel` existente. Sem mudança para a aba Documentos. Em `view=all`, a ação continua a deslocar a vista até aos documentos já renderizados.
- A consulta de `exam-context` inclui resultados já submetidos para a matrícula de origem; o UI mostra nota/estado e não deixa reenviar a mesma combinação sessão/componente/disciplina, mantendo a idempotência do endpoint.
- Erros de **revalidação após guardar** não são interpretados como erros da decisão persistida: o sucesso permanece visível e o operador pode revalidar sem duplicar o pedido.

**Interface:** títulos e próximas ações curtas; referências do decreto e explicações extensas recolhidas em «Ver detalhes». Formulários continuam sujeitos a permissões e conferências no backend, sem botões de override do estado académico.

**Limites que não podem ser declarados fechados:** abertura/publicação de sessões oficiais de exames, publicação de resultados de pauta, reabertura legal de matrículas anteriores e fonte de avaliação qualitativa EJA. Não existem fluxos ponta a ponta disponíveis com autorização e contratos suficientes para publicar essas operações por este painel. Ver #300 e #301.

**Verificação:** `tests/unit/raa-balcao-workspace-contract.spec.ts` protege a origem, documentos no mesmo separador e resultados idempotentes, integrado no `Gracefulness Balcao P0`. Continuam obrigatórios CI verde, testes com autenticação para cada papel/ano, e homologação da migration antes de merge/deploy. Nenhuma escrita manual no banco nem publicação de produção foi feita.

## Integração com os três trimestres — 29/10/2026

- `GET /api/secretaria/notas/periodos` exige turma e ano letivo explicitamente, verifica o tenant e a sessão da turma e devolve os três períodos reais. O trimestre corrente é calculado em `Africa/Luanda`; em pausas, períodos históricos ou contextos ambíguos não há trimestre predefinido.
- `EnrollmentPostActionModal` já não inicializa o 1.º trimestre arbitrariamente. Ao trocar aluno, matrícula, turma ou ano de origem limpa trimestre, disciplina e nota. Os três períodos são carregados sob demanda; o operador pode consultar períodos anteriores, mas a escrita retroativa exige a exceção formal de reabertura.
- `POST /api/secretaria/notas` verifica o vínculo ao ano, turma, matrícula ativa, trimestre e datas antes de delegar ao escritor canónico. Para 2026/2027, períodos sem proveniência do calendário MED são bloqueados com `OFFICIAL_CALENDAR_NOT_RECONCILED`.
- Migration `20271029235921_guard_grade_period_source_and_window.sql` mantém a versão endurecida do escritor (autorizações, escala 0–10 / 0–20, isolamento multi-tenant e auditoria) e acrescenta trigger que impede anos, turmas, matrículas ou períodos incompatíveis; rejeita trimestre futuro, encerrado ou sem fonte oficial, exceto reabertura legalmente autorizada para correção de notas.
- Importação de template em `sessions-target` passa a fornecer `source_template_id`, `source_item_id` e `source_version` à RPC oficial. Nova proteção não permite reaplicar o calendário apagando silenciosamente uma trava de notas já configurada.
- Reconciliação da Escola KLASSE 2026/2027: `supabase/ops/reconcile_klasse_school_2026_2027_calendar.sql` atualiza apenas o tenant de demonstração mediante aprovação explícita, preservando UUIDs usados pelas avaliações existentes e carregando eventos oficiais. Não deve ser executada automaticamente como migration.
- Testes: `grade-period-context.spec.ts`, `raa-balcao-workspace-contract.spec.ts` e regressão PostgreSQL descartável `regression_grade_period_guard.sql`. Abrangem três trimestres, fronteiras UTC/Luanda, mudança de aluno, falta de proveniência, ano incompatível, matrícula de turma errada, trimestre futuro e reabertura formal.

**Bloqueadores de merge/produção:** CI final verde; homologação da migration em PostgreSQL descartável; conciliação aprovada de dados 2026/2027 da Escola KLASSE (sem mexer diretamente em avaliações/notas); comparação com o template MED adotado e E2E autenticado para primeiro/segundo/terceiro trimestres, direcção, secretaria e professor. PR continua draft, sem deploy e sem mutações de dados de produção.

### Proteções adicionais de 2026/2027

- `turma_disciplinas.periodos_ativos` é respeitado em três camadas: GET de períodos, POST de notas e RPC PostgreSQL. `NULL` continua sem restrição trimestral explícita para preservar currículos legados; uma lista explícita restringe os trimestres.
- Para uma nota de 2026/2027, o trigger exige template MED oficial e publicado, item `PERIODO_LETIVO`, número, datas e ano coincidentes; apenas apresentar `source_template_id` não basta.
- A rota de importação e as rotas administrativas de calendário são consideradas parte do contrato: `aplicar-template` guarda proveniência e protege travas; `ajustes` conserva datas oficiais e requer motivo para alterar fecho; `periodos-letivos/upsert-bulk` recusa uma escrita genérica 2026/2027 sem proveniência.
- O teste SQL em PostgreSQL 17 descartável abrange também disciplina com trimestres limitados e item oficial inconsistente. Isto não substitui CI verde nem homologação com utilizadores reais.

## Calendário MED canónico e variações por curso (29/10/2026)

A fonte do ano letivo deixa de ser uma escolha arbitrária entre templates
de subsistema. A migração
`20271029235922_canonical_med_calendar_offering_profiles.sql` estabelece
**uma linha por ano** em `calendarios_oficiais_anos` (ano-base é PK), com
datas globais, versão e proveniência MED.

Os quatro `calendario_templates` já existentes para 2026/2027 são
**perfis regulatórios**, vinculados ao mesmo ano por
`calendario_canonico_ano`. Não são apagados nem renomeados: os registos
históricos continuam a apontar para os mesmos `source_template_id` e
`source_item_id`.

`school_education_offerings` faz a ligação direta entre **escola, curso,
subsistema e perfil**, através de `course_id` e `calendar_profile_id`.
Uma turma herda o perfil pela oferta do seu curso. A aplicação do calendário
usa a data canónica do ano e valida que os perfis concordam nos três
trimestres. Se houver divergência, não escolhe silenciosamente um deles.

Eventos comuns ao conjunto de cursos são publicados globalmente
(`offering_id = NULL`); exames, pausas ou datas não partilhadas são
publicados por oferta. A unicidade dos eventos passa a incluir
`offering_id`, com `NULLS NOT DISTINCT` para impedir duplicação dos
eventos globais. Os filtros de nível, ciclo, classe e tipo de curso
restringem os eventos de cada oferta.

**Consumidores alterados:** virada do ano no Balcão, aplicação do calendário
no portal administrativo, onboarding de sessão e respetivos seletores.
Rotas antigas que tentam aplicar quatro perfis como quatro calendários
de 2026/2027 ficam bloqueadas e indicam a aplicação canónica.

**Invariantes no PostgreSQL:** ligação do perfil ao ano, compatibilidade
oferta–subsistema–curso, imutabilidade dos itens MED publicados e fonte
oficial dos períodos/eventos. O writer de notas continua a usar a sessão
de origem, os vínculos RAA e as autorizações da pauta.

**Compatibilidade/homologação:** a migração exige que os quatro perfis MED
2026/2027 já publicados concordem em datas globais, versão e trimestres.
O backfill liga somente os metadados dos perfis, sem alterar notas,
matrículas, turmas ou os UUIDs históricos. A **Escola KLASSE** ainda
possui períodos sem proveniência oficial; exige operação de conciliação
manual, explicitamente autorizada, antes da aprovação para produção.

**Validações adicionadas:** teste unitário do planeador canónico, contratos
do Balcão e regressões SQL em PostgreSQL 17 descartável. Os testes de
eventos verificam escopo por oferta, importação idempotente, bloqueio
de troca de perfil e imutabilidade do período MED. Não há execução de
migrations nem normalização automática de dados na produção nesta PR.

**Limitação operacional conhecida:** a preparação do ano utiliza
consultas e chamadas de escrita separadas no servidor; antes do
deploy final deverá ser homologada a recuperação em caso de falha
intermédia e a consistência de todas as ofertas. O merge deve
permanecer bloqueado até CI completo e homologação autenticada.

## Etapa 1 — Resolução de eventos por curso (29/10/2026)

- **Módulo central de leitura:** `apps/web/src/lib/academico/calendar-events-read.ts`.
  Um mesmo contrato filtra `calendario_eventos` por `escola_id`,
  `ano_letivo_id` e ofertas educativas autorizadas. `offering_id IS NULL`
  significa evento de toda a escola naquele ano; `offering_id` definido só
  é visível a quem pertence ao curso/oferta. A ausência de oferta autorizada
  **não** significa mostrar todos os cursos.
- **Portal do aluno:** `GET /api/aluno/home/academic-events` usa
  `getAlunoContext`, `resolveSelectedStudentId` e
  `resolveBoletimMatricula` para validar primeiro o educando autorizado e
  a sua matrícula no ano solicitado. Depois obtém o `curso_id` da turma
  dessa matrícula e resolve a oferta ativa da escola. Evita usar a turma de
  outro educando de um encarregado ou de outro ano letivo.
- **Falhas explícitas:** curso sem oferta ou oferta ambígua resulta em 409;
  `studentId` de aluno não autorizado resulta em 403; identificadores
  inválidos e duplicados não chegam ao PostgREST. A resposta mantém o
  contrato `{ok, items}` do widget e limita a 3 eventos no banco.
- **Histórico:** a leitura preserva o `ano_letivo_id` solicitado; não
  recupera automaticamente eventos de outro ano quando não há matrícula.
- **Validação:** typecheck aprovado e **148 testes unitários** aprovados,
  incluindo a regressão académica existente. Testes específicos protegem
  o isolamento por curso, filtro de ano, autorização do aluno, e falhas
  de mapeamento. Auditoria Supabase somente leitura: não foram detetadas
  ofertas ativas duplicadas para o mesmo curso na mesma escola.
- **Próximas etapas, ainda não executadas:** adaptar calendário do
  professor, calendário da secretaria e `dry-run` da virada do ano;
  homologar portais autenticados e aguardar GitHub Actions. Sem merge nem
  execução de migration no Supabase de produção.
