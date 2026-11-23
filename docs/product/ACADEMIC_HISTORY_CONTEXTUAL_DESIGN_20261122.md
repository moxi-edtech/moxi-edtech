# KLASSE — Contexto académico por operação e Arquivo Académico
Data: 2026-11-22  
Branch: `feat/academic-history-contextual-20261122` (base: `main`)  
Estado: implementação reconciliada com `main` e migração SEC-ACADEMIC-360 aplicada em produção; cobertura E2E de todos os módulos ainda não comprovada.

## Problema e decisão
O seletor `AcademicYearSelector` na topbar alterava o `ano_letivo_id` para módulos diferentes. O `AppShell` transportava esse filtro pela sidebar, inclusive entre operações não relacionadas. A Central de Documentos tinha ainda um ano local distinto do ano da URL; ao enfileirar documentos escolhia a URL prioritariamente, permitindo construir um pedido incompatível com a turma do formulário (a API devia bloqueá-lo).

**Decisão:** ano atual automático por operação; ano anterior explícito no dossier, pedido de documento ou Arquivo Académico. Não utilizar cookie, `localStorage` nem estado universal como fonte do ano letivo. A URL pode transportar o ano para partilha/deep link **da mesma operação**, mas a navegação para outro módulo regressa ao seu contexto normal. A API e o banco continuam a validar o `session_id`/ID canónico.

## Superfícies desta entrega
1. **AppShell** — retirar seletor universal e faixa vazia; manter alerta contextual quando a página está explicitamente em modo histórico. Sidebar deixa de propagar parâmetros de ano de uma operação para outras.
2. **Arquivo Académico** — entrada em Operações Académicas de Operações e Secretaria; anos anteriores vêm de `/api/secretaria/school-sessions`; seleção não altera o contexto de outros módulos. Além dos atalhos, oferece pesquisa paginada de turmas antigas e emissão direta de listas nominais históricas em PDF/Excel através dos endpoints canónicos, com autorização e auditoria existentes.
3. **Central de Documentos (QuickDocHub)** — seleção do ano local baseada em `anos_letivos.id`, inclusive deep link validado contra a lista autorizada; filas de lotes enviam sempre esse ID; mudança de ano limpa turma, filtros dependentes e período. Os trimestres vêm de `/api/secretaria/relatorios/mapa-aproveitamento?ano_letivo_id=...`.
4. **Documentos Oficiais em lote** — seletor de ano próprio; turmas do GET filtradas por `turmas.session_id`, escola e ano; períodos do mesmo ano; POST recebe escola explícita autorizada. Em ano fechado apresenta apenas ações de consulta e lista nominal histórica, sem botões de lançamento de notas nem emissão de novos lotes oficiais. As contagens de alunos usam a política nominal histórica, com paginação por cursor e sem truncamento silencioso.
5. **Listas de matrículas** — link direto de arquivo com `ano_letivo_id` valida a opção recebida; seletor da página partilha o ano escolhido na URL sem mudar a sidebar.
6. **Dossier do aluno** — o percurso 360º existente apresenta anos completos (`2025/2026`) e detalhe de ano selecionado. Esse detalhe preserva o resumo de até 8 disciplinas prioritárias da timeline e carrega, separadamente, todas as disciplinas documentadas do ano em páginas de 25, sem as apresentar como avaliações trimestrais nem como pauta emitida. Ano inexistente oferece retorno a todos os anos.

## Conceito de domínio
- `escola_id`: autorização multi-tenant do utilizador.
- `ano_letivo_id`: período académico canónico, identificado pelo UUID e não pelo ano civil isolado.
- `aluno_id`: pessoa; mantém identidade entre matrículas e anos.
- `matricula_id`/`turma_id`: registros do período de origem; validar pertença à escola e à sessão.
- `periodo_letivo_id`: subperíodo validado no mesmo ano da turma/matrícula.
- `data_emissao` versus `ano_referencia`: conceitos diferentes nos documentos oficiais.

Não sincronizar automaticamente notas finais históricas para avaliações trimestrais. `HIST_FINAL` é nota final documental, não avaliação MAC/NPP/NPT. Não reabrir anos fechados nem repetir migrations de reconciliação para simplificar UX. A regularização histórica usa os endpoints/RPCs atuais com evidência e auditoria; o Arquivo Académico é uma porta de navegação, não uma fonte de dados alternativa.

## Comportamento da experiência
| Entrada | Contexto inicial | Histórico | Escrita |
|---|---|---|---|
| Dashboard, notas, frequência, turmas | ano ativo da escola | arquivo ou pesquisa contextual | só no ano/período autorizado |
| Alunos | ano atual no módulo | dossier e percurso académico | apenas em registos editáveis |
| Turmas e classes | turmas atuais; classes pertencem ao catálogo | turmas vinculadas a ano específico | não alterar turmas fechadas |
| Documentos oficiais | ano ativo | seleção no pedido ou arquivo | lote oficial histórico bloqueado até existir emissão excepcional autorizada |
| Lista nominal | turma e ano do próprio pedido | lista histórica permitida pelas políticas vigentes | não altera matrícula |
| Financeiro | conta corrente, incluindo dívidas antigas | filtro competência/ano | cobrança preserva competência original |
| Reconciliação Histórica | caso ou matrícula de origem | entra pelo arquivo/dossier | operações especiais auditadas, nunca um `WRITE` genérico |

## Limites explícitos desta branch
- O Arquivo Académico acrescenta consulta paginada real de turmas e listas históricas, reutilizando entidades e endpoints existentes. O dossier exibe a timeline canónica com até 8 disciplinas no resumo e a lista completa paginada de resultados finais existentes em `historico_disciplinas` por `historico_anos` do aluno/escola/ano. Para a pauta oficial assinada, continua necessária a fonte versionada da turma/matrícula.
- Emissão de **novos** lotes oficiais de pautas/certificados para anos fechados permanece proibida pelo contrato atual. Segunda via deve reutilizar documento oficial versionado e sua proveniência; não contornar `ACADEMIC_YEAR_CLOSED`.
- O Balcão mantém o seletor **local** enquanto seus fluxos de rematrícula e regularização de origens/destinos não estiverem totalmente desacoplados. Não removê-lo sem E2E.
- Dados de `anos_letivos` projetados/planeados não devem aparecer como arquivo histórico.
- A experiência do Arquivo não exigiu migração de dados. **Exceção de segurança já aplicada:** a antiga RPC `SECURITY DEFINER` da timeline 360 foi protegida com autenticação, autorização por escola e validação da pertença do aluno por meio de `20271202000000_guard_timeline_360_school_role.sql`. Essa versão ficou registada depois de `20271201100000`. Não criar duplicidade de notas, matrículas, turmas ou documentos.

## Continuação da implementação — 22/11/2026

### Continuação do dossier e isolamento multi-escola — 22/11/2026

- A API `GET /api/secretaria/alunos/[id]/timeline-360` agora aceita `escola_id` opcional, resolve a pertença do utilizador a essa escola e confirma que o aluno pertence ao tenant **antes** de invocar a RPC `SECURITY DEFINER`. O componente envia a escola do portal e invalida a leitura quando o contexto muda. O endpoint bloqueia cache da resposta de dados sensíveis e transforma SQLSTATE `42501` da RPC em HTTP `403` sem expor erros SQL internos.
- Novo `GET /api/secretaria/alunos/[id]/historico-disciplinas?ano=2025&page=1&escola_id=...`: leitura do pai `historico_anos` filtrada por escola + aluno + ano de início, seguida de `historico_disciplinas` por ID autorizado do pai. Paginado em 25 com `count: exact`, ordem estável e `private, no-store`; rejeita ano/página inválidos, utilizadores sem papel operacional e alunos de outras escolas.
- `HistoricalDisciplineResultsPanel` substitui o detalhe limitado às 8 disciplinas do resumo. Apresenta nota final e resultado documental, pesquisa por ano escolhido, paginação, erros e estado vazio sem fallback para ano atual ou notas operacionais. A timeline conserva as 8 disciplinas de destaque no cartão-resumo (não é uma pauta).
- A timeline mantém uma chave da consulta carregada (`alunoId + escolaId`) e bloqueia a apresentação de resultados de uma navegação anterior; o painel é remontado quando a identidade do aluno, a escola ou o ano muda. Evita o flash de dados entre contextos ao usar duas abas ou alternar portais.
- **Não cria notas, não sincroniza notas históricas para trimestres nem emite pauta ou certificado**. O novo GET de disciplinas não exige alteração de esquema, mas a RPC 360 legada exige a migração de segurança SEC-ACADEMIC-360 descrita abaixo. Históricos transitados permanecem numa área distinta. Falta validar leitura RLS autenticada real e emissão legal da pauta versionada antes de afirmar cobertura completa.
- Testes: `historical-discipline-query.spec.ts` valida ano/página; `academic-history-contextual.spec.mjs` verifica escopo multi-escola da timeline e consulta documental somente leitura. CI da branch deve ser reconfirmado no último SHA.

### SEC-ACADEMIC-360 — correção P0 de autorização da RPC

**Verificação diretamente no projeto Supabase KLASSE em 22/11/2026 (somente leitura):** a função `get_aluno_timeline_360(uuid,uuid)` estava em `SECURITY DEFINER`, tinha `EXECUTE` disponível a `authenticated` (não a `anon`), e o seu corpo não verificava `auth.uid()` nem `user_has_role_in_school`. Uma chamada direta à RPC podia contornar a validação existente na API Next.js. Esse risco não fica resolvido apenas com o filtro de escola no frontend/backend HTTP.

**Migração aplicada em produção e registada no ledger:** `supabase/migrations/20271202000000_guard_timeline_360_school_role.sql`. Preserva o corpo e a forma JSON da RPC, convertendo a função SQL para PL/pgSQL para **negar antes de ler** quando faltar identidade autenticada, papel operacional autorizado na escola pedida ou vínculo do aluno com essa escola. A condição falha com SQLSTATE `42501`. Executar `REVOKE` de `PUBLIC, anon`, manter `GRANT` apenas para `authenticated, service_role`. A autorização deve ser validada no banco com utilizadores reais de escolas distintas; CI estática não prova RLS nem políticas em produção.

**Integridade do ledger remoto — verificada:** o último registo anterior era `20271201100000`; a migração foi executada numa transação SQL com preflight de versão e lock transacional, seguida do registo atómico exato de `20271202000000` em `supabase_migrations.schema_migrations` (`guard_timeline_360_school_role`, `statements[1]` com o SQL versionado). Não foi usado `db push` global nem reexecutadas outras migrações; o conector `apply_migration` não foi usado porque geraria um número de versão diferente.

**Verificação SQL posterior à migração:** a chamada com ator autenticado e papel de escola autorizado devolveu JSON de tipo `array`; chamadas para aluno de outra escola, aluno incompatível com a escola e identidade ausente falharam com SQLSTATE `42501` (quatro cenários PASS numa transação de teste com `SET LOCAL ROLE authenticated`, revertida com `ROLLBACK`). `anon` não tem `EXECUTE`; `authenticated` e `service_role` têm, mas a função exige `auth.uid()` e papel autorizado. Os papéis `diretor` e `admin_secretario` foram acrescentados antes da aplicação. A expressão documental de resultado foi comparada à RPC anterior e permaneceu equivalente. **Não equivale a smoke HTTP completo:** falta validar consumidor real do portal, aluno sem papel e duas sessões em paralelo; nenhum bypass genérico por `service_role` deve ser adicionado.

### Estado de produção e evidências — 22/11/2026

**Supabase KLASSE:** projeto `wjtifcpxxxotsbmvbgoq`, versão `20271202000000_guard_timeline_360_school_role` no ledger, aplicada atomicamente após preflight (versão anterior `20271201100000`). A RPC `public.get_aluno_timeline_360(uuid,uuid)` é agora `plpgsql SECURITY DEFINER`, com `auth.uid()`, `user_has_role_in_school` e validação de `alunos.escola_id` antes das consultas. `anon` sem `EXECUTE`; `authenticated` e `service_role` com `EXECUTE` sob guard interno.

**Testes no banco (transação revertida):** permitido para membro autorizado da própria escola; negado para outra escola; negado para aluno de escola diferente; negado para identidade nula — **4/4 PASS**. A comparação das expressões de consulta confirmou que o resultado documental/financeiro original da RPC permaneceu inalterado.

**Atenção ao Security Advisor:** o linter continua a sinalizar a RPC em `authenticated_security_definer_function_executable` por estar exposta como `SECURITY DEFINER`. Trata-se de um aviso genérico que **não comprova bypass**, mas requer revisão periódica dos grants e dos guards. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

**Limites desta validação:** não foi concluído o smoke HTTP autenticado do portal contra dois tenants, o download de PDF existente por usuário operacional e a navegação com duas abas. O teste com `SET LOCAL ROLE authenticated` não é uma sessão real do browser. O merge é uma decisão de integração de código, não uma confirmação de deploy nem de homologação completa.

### Matriz de módulos — continuação implementada na branch

As consultas adicionais preservam as tabelas canónicas, sempre em `READ` e por escola/ano/turma autorizados. Os resultados são locais ao Arquivo Académico, sem seletor universal.

| Módulo | Implementação na branch | Limite de produto |
|---|---|---|
| Classes | Catálogo existente e pesquisa paginada de turmas por ano | Sem alteração ao cadastro de classes |
| Notas | Timeline 360 e resultados finais de `historico_disciplinas` | Não inventar notas MAC/NPP/NPT |
| Pautas | `/arquivo/registos?tipo=pautas`, filtro de trimestre e `/arquivo/pauta/[id]` para PDF já publicado | Não gera pauta em ano fechado, exige PDF publicado e período do mesmo ano |
| Documentos | Ano local na Central de Documentos e seleção canónica da emissão | Segunda via extraordinária de documentos não suportados fica bloqueada |
| Matrículas | Percurso 360 e listas nominais históricas | Matrícula original não é substituída pela atual |
| Horários | Versões publicadas/arquivadas da mesma turma + aulas/slots/disciplinas | Nunca cria draft via GET, histórico só da turma selecionada |
| Frequência | Agregação de snapshots `frequencia_status_periodo` por trimestre, com paginação e recusa de totais parciais | Não há fallback que invente presenças; falta um mapa assinado onde não existir snapshot |
| Currículo | Histórico de `curso_curriculos`/`curso_matriz` por ano, classe e curso | Não replica matrizes nem permite editar anos fechados |
| Financeiro | Read model `vw_financeiro_propinas_mensal_escola` (security_invoker) por competência e ano, apresentando simultaneamente atrasos de **todos os anos** | Resumo de cobranças vencidas, não substitui conta corrente nem oculta débitos não vencidos |
| Relatórios | Comparação por dois anos com contagens exatas de turmas, matrículas vinculadas e históricos; filtro de trimestre para pautas publicadas/frequência | Compara **volumes**, não médias escolares; só períodos MED canónicos verificados |

**Limites de segurança e integridade:**
- `registos`: ano/UUID/turma/tipo obrigatórios, `CLOSED`, `session_id`, papel de leitura explicitamente autorizado na escola selecionada; volumes limitados sem truncamento silencioso. Não devolve `pdf_path` nem cria versões.
- `pauta/[id]`: reautoriza a escola, a turma e o período/ano, exige pauta `SUCCESS` com PDF e emite URL assinada de curta validade. Nunca chama geradores que escrevem em pautas fechadas.
- `financeiro`: usa papel financeiro/administrativo explícito, `ano_letivo_id` canónico e read model protegido por RLS; o filtro de mês não altera o total de dívidas vencidas de anos anteriores.
- `comparacao`: conta `matriculas.session_id` sem inferir matrículas legadas para outro ano; `trimestre` usa `readVerifiedAcademicTrimesters` dos **dois** anos antes de comparar.
- Todos os novos endpoints são `private, no-store`, sem `service_role` e sem métodos de escrita. As leituras usam `authorizeAcademicArchiveRead`/`requireRoleInSchool` e não dependem da escola padrão em `profiles.escola_id`; o Financeiro usa gate específico. Esquema/índices existentes são reutilizados.
- **Gates antes da publicação do frontend**: migração P0 da timeline 360 **concluída**; restantes smoke HTTP/E2E autenticados multi-tenant, snapshots RLS, PDF oficial publicado, permissões financeiras, concorrência de duas abas e tema claro/escuro **não homologados neste relatório**. CI verde é necessária, mas insuficiente para declarar a experiência em produção homologada.

### Serviços e comportamento acrescentados

- `GET /api/secretaria/operacoes-academicas/arquivo/turmas`: ano UUID obrigatório, verificação de utilizador e pertença à escola, `authorizeTurmasManage`, ano `CLOSED`, filtro `escola_id + session_id`, 25 itens por página, pesquisa de nome com `ILIKE` literal escapado. Resposta `private, no-store`. Não existe endpoint paralelo de escrita.
- `HistoricalTurmasPanel`: consulta autónoma com pesquisa, paginação, estados de carregamento/erro e isolamento quando o ano muda. Ligação para detalhe da turma; PDF/Excel nominal usam os endpoints existentes com `mode=ano_letivo` para aplicar a política de lista histórica.
- `loadHistoricalRosterCounts`: contagem por cursor de matrículas da sessão histórica, incluindo os estados históricos admitidos pela política de lista nominal; exclui canceladas/pendentes e falha se não conseguir concluir a leitura. O ano atual mantém a regra operacional de matrículas ativas.
- `Admin/turmas/page.tsx`: tanto SSR pela view como o fallback por tabela confirmam a sessão académica autorizada, incluindo a visita sem `ano_letivo_id`. O fallback não pode listar todos os anos.
- `resolveAcademicYearContext`: recebe opcionalmente `requestedEscolaId` e chama o resolver de pertença antes de procurar o ano. `periodos-letivos`, `mapa-aproveitamento` e os pedidos de lotes/documentos usam a escola explícita do portal.
- `QuickDocHub` e `DocumentosOficiaisBatchClient`: link de ano desconhecido ou de outra escola não pode resultar silenciosamente em emissão no ano atual. Ano duplicado bloqueia o pedido e exige ajuste de configuração.
- Os lotes recentes da Central de Documentos continuam **gerais da escola**, sem filtro por ano: a UI informa isso explicitamente. Não atribuir um ZIP antigo ao ano escolhido sem conferência das turmas e proveniência.

### Testes adicionados ou atualizados

- `apps/web/tests/unit/historical-discipline-query.spec.ts`: ano de origem, paginação estrita, rejeição de fallback implícito.
- `apps/web/tests/unit/archive-domain-read-contracts.spec.mjs`: contratos de tenant, ano, trimestre, versão, limites de leitura, assinatura de PDF, competência financeira e comparação.

- `apps/web/tests/unit/archive-turmas-query.spec.ts`: validação de UUID/página/pesquisa, bloqueio de filtro de polo e escape literal de caracteres `ILIKE`.
- `apps/web/tests/unit/historical-roster-count.spec.ts`: 503 matrículas, paginação com cursor, status históricos e rejeição de matrículas de outra escola/ano.
- `apps/web/tests/unit/academic-history-contextual.spec.mjs`: contratos de shell, arquivo, consulta histórica, SSR/fallback, documentação nominal, read-only, períodos e relatórios com escola explícita.
- `apps/web/tests/unit/admin-theme-coverage.spec.mjs`: adaptado ao `AppShell` sem a antiga faixa de seletor. Os novos componentes usam tokens semânticos do tema.

**Estado de validação:** os testes acima foram adicionados ao repositório e fazem parte dos workflows GitHub aplicáveis. O teste de contrato `SEC-ACADEMIC-360` valida a migração de guarda da RPC. Não assinalar como aprovados enquanto o último SHA da branch não tiver checks concluídos. Após a migração, testes SQL com um ator autenticado real simulado por `SET LOCAL ROLE authenticated` confirmaram autorização e isolamento da RPC; testes HTTP/E2E de múltiplos papéis e escolas, duas abas, histórico legal e concorrência ainda devem ser concluídos antes de homologar a experiência publicada.

### Contrato de registos históricos

- Uma lista nominal histórica usa a **turma de origem**, não a matrícula atual; categorias incluídas: ativa, concluída, transferida, trancada e desistente. Cancelada e pendente ficam excluídas conforme `listaNominalPolicy`.
- Notas finais em `historico_disciplinas` permanecem registos documentais; não inventar MAC/NPP/NPT, nem criar avaliações para preencher o resumo do dossier.
- O arquivo pode navegar para a Reconciliação Histórica existente, mas não cria exceção genérica para editar ano fechado.
- As rotas de download e emissão continuam sujeitas aos gates originais de plano, autorização e auditoria.

## Segurança e critérios de aceitação
- [ ] Sessão não autenticada, escola de outro tenant, e papel sem acesso não consultam nem mutam dados.
- [ ] Link histórico da turma 2025/2026 nunca carrega a turma da escola ou sessão 2026/2027.
- [ ] Trocar ano na Central de Documentos limpa a seleção de turma e período antigos.
- [ ] No lote, GET de turmas e GET de trimestres usam exatamente o mesmo `ano_letivo_id`.
- [ ] POST com turma de outro ano é rejeitado pela API com `409 CROSS_YEAR_ENTITY_MISMATCH`.
- [ ] Documento histórico sem snapshot/fecho válido não é emitido.
- [ ] Ano encerrado não permite nova pauta/certificado em lote pelo formulário operacional.
- [ ] Duas abas com anos distintos não se interferem. Sidebar regressa ao padrão do módulo destino.
- [ ] Nenhuma query de notas/documentos faz fallback implícito para matrícula mais recente.
- [ ] E2E com escola Curtume, Secretaria, Operações e casos reais autorizados antes de homologar o frontend em produção.
- [x] SEC-ACADEMIC-360: migração `20271202000000` aplicada em produção, guard interno de ator/papel/escola e testes SQL da RPC aprovados. Falta smoke HTTP com JWT real do portal.

## Próximos PRs recomendados
1. **Pauta oficial e proveniência**: ligar os resultados documentados ao snapshot de pauta efetivamente fechado, por turma/matrícula/ano e versão, sem sintetizar notas trimestrais nem fazer emissão automática.
2. **Emissão/segunda via histórica**: selecionar snapshot oficial, auditar motivo de reemissão, preservar versão/referência/validade; adaptar endpoint específico em vez de contornar guard de escrita.
3. **Balcão e professores**: suprimir seletores residuais quando entidade contextual estiver demonstravelmente completa; preparar próximo ano via Virada e não por seleção global.
4. **Relatórios e financeiro**: filtros locais de competência e comparação, mantendo valores de anos anteriores na conta corrente.

### Fontes de verdade
- `apps/web/src/lib/academic-year/context.ts`
- `apps/web/src/lib/academic-year/navigation.ts`
- `apps/web/src/lib/documentos/listaNominalPolicy.ts`
- `apps/web/src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx`
- `docs/ops/curtume-notas-finais-reconciliacao-20261121.md`

## Publicação
Integração com `main` solicitada após atualização da documentação e CI verde do commit final. A migração SQL está aplicada, mas **merge da PR não é deploy**. O frontend continua dependente de publicação Vercel e smoke autenticado; não declarar a publicação como concluída sem confirmação do SHA em produção.

### Auditoria de cobertura de rotas e trimestres — follow-up

A remoção do seletor universal não altera automaticamente cada API. Auditoria dirigida após CI verde anterior identificou contratos antigos e adicionou correções fail-closed:

- `POST /api/secretaria/documentos-oficiais/lote`: `ano_letivo_id` e `turma.session_id` já eram validados. Agora qualquer `periodo_letivo_id` explícito também deve pertencer à escola e ao ano do pedido **antes** de criar o job; pautas trimestrais e boletins trimestrais com período explícito exigem `readVerifiedAcademicTrimesters` e `requireVerifiedTrimester`. Não abre emissão em anos encerrados.
- `GET /api/secretaria/turmas/[id]/horario/versao`: confirma que a turma pertence à escola e a um ano canónico, rejeita `ano_letivo_id` cruzado e **nunca cria draft** se o ano estiver encerrado ou planeado. O editor corrente mantém criação de draft no ano ativo por compatibilidade.
- `ArchiveTurmaRecordsPanel`: seleção local de trimestre para frequência histórica e pautas. Os filtros não mudam o ano do portal nem o período de outro módulo.
- `GET /api/financeiro/relatorios/{resumo,propinas}`: elimina fallback silencioso para `new Date().getFullYear()`; ID inexistente devolve 404, ano mal formatado 400, ID e ano inconsistentes 409. Isto não altera nem oculta dívidas históricas.

**Cobertura conhecida, não exaustiva:** `GET /api/professor/periodos` e `GET /api/secretaria/relatorios/mapa-aproveitamento` já verificam o ano e a origem canónica dos trimestres; `GET /api/secretaria/operacoes-academicas/arquivo/registos` filtra os períodos de leitura por ano/escola, enquanto `/arquivo/comparacao` verifica o trimestre canónico dos dois anos. Outros consumidores legados, por exemplo seleção de trimestre no portal do professor e módulos de notas/frequência, precisam de varredura de rota/cliente e E2E autenticado; não confundir testes de contrato com cobertura universal.

A barra de navegação já não mostra `AcademicYearSelector`, mas `AcademicContextSync` ainda acrescenta automaticamente `ano_letivo_id` nas rotas operacionais permitidas e `preserveAcademicContextHref` pode transportar o filtro em ligações contextuais. Isto é diferente do seletor global visual e merece auditoria em navegação entre operações para impedir estado antigo herdado.

Os testes adicionais estão em `apps/web/tests/unit/academic-year-period-coverage.spec.mjs`. A migração SQL P0 `20271202000000_guard_timeline_360_school_role.sql` **foi aplicada e verificada**. O frontend ainda requer publicação e smoke de operação.

