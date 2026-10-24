# Exploradores — backlog de integração e homologação (23/10/2026)

**Escopo:** Curso, Classe, Turma, Professor e Disciplina. **Fonte:** PR #262 (empilhada sobre #261), commit de referência `e6b592bd`; relatório de CI 23/23 fornecido pelo responsável. **Estado de release:** não integrado, não homologado em sessão autenticada, não publicado.

## Estado dos incrementos

| ID | Entrega de código | Estado de produto | Prova adicional |
| --- | --- | --- | --- |
| EX-007 | Paginação SQL real de Curso, busca literal e filtros por ano/classe | Implementado; release pendente | RPC instalada, autorização e página >100 turmas |
| EX-008 | Curso → Classe → Turma e ações contextuais | Implementado; release pendente | Navegação autenticada, retorno, vazios e permissões |
| EX-009 | Atribuições Turma × Disciplina e agenda publicada do Professor | Implementado; release pendente | Professor removido/sem perfil, vínculo legado e horário sem atribuição |
| EX-010 | Evidência curricular por turma, docente e horário | Implementado; release pendente | Matriz publicada/inativa por versão, ano e resultados parciais |

**Regra:** checks verdes não equivalem a homologação, migration instalada ou deploy. Não marcar EX-007–010 como entregues em produção.

## Backlog executável, por dependência

| ID | Prioridade | Estado | Critério de aceite |
| --- | --- | --- | --- |
| EX-REL-01 | P0 | **Parcial: inspeção read-only realizada, falta ensaio/rollback aprovado** | Comparar migrations EX-005 (`20271015100001`) e EX-007 (`20271015100002`) com histórico e catálogo reais do Supabase, sem editar migrations já aplicadas. Registar plano e rollback. |
| EX-REL-02 | P0 | **Bloqueado: não existe staging e branch faturada exige autorização** | Aplicar RPC `command_center_course_turmas_page` em ambiente controlado; validar `SECURITY INVOKER`, grants sem `anon`, isolamento entre escolas, paginação 1–50, contagem e erros 403/503. |
| EX-REL-03 | P0 | Pendente | Homologação autenticada de Secretaria e Direção, pelo menos duas escolas, ano corrente e histórico; >100 turmas, filtros, paginação, links, professor removido, vínculos legados, versão curricular inativa e dados parciais. |
| EX-REL-04 | P0 | **Parcial: ancestralidade comprovada; homologação/merge pendentes** | Revalidar #261 → #262, conflitos e CI no HEAD final de ambas; integrar em ordem, sem omitir gates de segurança/financeiro de outras frentes. |
| EX-REL-05 | P0 | Pendente | Deploy controlado, smoke tests autenticados dos cinco exploradores, observabilidade e rollback testado. |
| EX-QUAL-01 | P1 | Pendente | Medir p95, bytes, requisições e `EXPLAIN (ANALYZE, BUFFERS)` em estrutura representativa; confirmar índices e ausência de N+1. |
| EX-QUAL-02 | P1 | Pendente | Acessibilidade com teclado, foco, zoom e leitor de ecrã nas cinco vistas em sessão real. |
| EX-QUAL-03 | P1 | Pendente | Confirmar rótulos: vínculo não resolvido ≠ inexistente; ausência em recorte parcial ≠ ausência comprovada; versão curricular inativa ≠ versão duplicada. |

## Evidência auditada no Supabase — 23/10/2026

- Projeto KLASSE: `wjtifcpxxxotsbmvbgoq`, PostgreSQL **17.6**; inspeção exclusivamente de leitura.
- Histórico: **646** migrations registadas; `20271015100000_command_center_course_overview` está no ledger; `20271015100001` (EX-005) e `20271015100002` (EX-007) **não** estão.
- Catálogo `pg_proc`: `command_center_course_overview(uuid,uuid,uuid)` existe, é `STABLE SECURITY INVOKER`, com `EXECUTE` para `authenticated` e `service_role`; sem `anon`/`PUBLIC`. O corpo instalado mantém o filtro antigo de classe e `LIMIT 100`.
- Catálogo `pg_proc`: `command_center_course_turmas_page` **não** existe; o código EX-007 depende dela e responde 503 até a instalação.
- Colunas usadas pelas propostas foram verificadas nas tabelas necessárias. Consulta agregada encontrou **6** classes reutilizadas elegíveis de 2025 com `ano_letivo_id` não nulo e diferente; nenhum caso equivalente no recorte 2026. **Não** inferir sucesso funcional sem execução da RPC.
- Dependências Git: `main → #261` (60 commits à frente, nenhum atrás na consulta); `#261 → #262` (27 à frente, nenhum atrás), antes deste novo commit documental. O HEAD `19dc8093` teve os 16 workflows consultados concluídos com sucesso; evidência de CI não equivale a autenticação real.
- Existe **zero branch de desenvolvimento** no Supabase. A criação de uma branch de homologação requer confirmação de custo: **US$ 0,01344/h**, valor informado pela ferramenta para esta organização; nenhuma branch foi criada e nenhuma alteração DDL executada.
- **Não usar `supabase db push` globalmente**: o handoff técnico `docs/HANDOFF_KLASSE.md` alerta que o ledger de migrations pode não corresponder a objetos reais e que push global pode reaplicar migrações não registadas. As versões EX-005/007 são também anteriores às últimas versões já instaladas (`20271022142000`). Primeiro reconciliar ledger, catálogo, dependências e método de aplicação seletiva.
- O advisor de segurança encontrou alertas preexistentes sobre RLS sem políticas e funções `SECURITY DEFINER` executáveis por `anon`. Não são atribuídos às RPCs EX-005/007; exigem triagem de segurança separada e **não** permitem dispensar testes de isolamento da nova função.

### Runbook bloqueado por autorização de staging

1. Aprovar custo de branch de desenvolvimento, ou fornecer ambiente de homologação existente. Sem isto, não criar projeto faturado nem alterar produção para testar.
2. Confirmar em staging o `pg_get_functiondef` **antes** de EX-005, assinatura e ACL, índices, enum curricular, e a lista de objetos dependentes. Guardar a definição prévia como rollback versionado e restrito; não inventar rollback com `DROP` indiscriminado.
3. Aplicar **apenas** EX-005 e depois EX-007, transacionalmente, mantendo versões canónicas e reconciliação explícita no ledger; não executar o restante catálogo pendente.
4. Validar `pg_proc`, `proacl`, `has_function_privilege` para `anon`/`authenticated`, acesso cruzado entre duas escolas e papéis reais; 127 turmas sintéticas, filtros, pesquisa literal, ano histórico, 401/403, parâmetros inválidos e erros 503.
5. Homologar no preview com Secretaria/Direção, três atendimentos consecutivos, foco/scroll e vínculos curriculares por versão; impedir publicação se faltar teste ou se criar regressão.
6. Após aprovação, aplicar em produção com backup do corpo/ACL anteriores e plano de reversão testado, publicar na ordem da stack, monitorizar e executar smoke. Não tratar branch vazia (sem dados reais) como réplica funcional completa.

**Gate atual:** execução do plano interrompida **antes** da criação de staging por custo não autorizado; EX-REL-03, merge e deploy não foram executados.

## Continuação de código — 24/10/2026 (sem branch Supabase paga)

- O responsável **não autorizou o custo** de uma branch Supabase (US$ 0,01344/h); a criação foi cancelada. Não tentar criá-la novamente sem nova autorização. Supabase instalado mantém-se **intocado**.
- O teste `supabase/ops/tests/regression_command_center_course_overview.sql` foi endurecido no PostgreSQL 17 descartável já usado pelo workflow `Command Center Contextual`: replica o tipo real `curriculo_status`, ativação do RLS nas sete tabelas académicas de consulta, `FORCE RLS` em `turmas`, `matriculas` e `alunos`; dois tenants sintéticos com linhas próprias, privilégios de função, 127 turmas em seis páginas, janela fora do intervalo, limites, termo literal, papel não autorizado e JWT ausente.
- **Limitação deliberada:** as policies de RLS no teste são **simplificadas**, não uma réplica literal das policies e dependências do Supabase. O ensaio prova isolamento nesta fixture e cobertura de SQL proposto; **não** prova que uma conta real de Secretaria tem todas as permissões após aplicação em produção.
- `course-turmas-error.ts` e a rota de paginação passam a mapear SQLSTATE `42501` para HTTP **403**, mantendo `22023→400` e RPC ausente `PGRST202/42883→503`. Unit tests específicos foram adicionados.
- `CourseContextView` comunica ao proprietário do contexto que a turma selecionada foi limpa quando mudam página ou pesquisa, evitando restaurar uma seleção obsoleta ao reabrir.
- As migrations versionadas **EX-005/EX-007 não foram alteradas nem aplicadas** neste incremento. Nenhum dado académico ou financeiro foi escrito.
- **Gate:** aguardar workflows no último HEAD, ensaio com autenticação real em ambiente seguro (sem custo adicional aprovado) e aplicação controlada da RPC. Não integrar #261/#262 nem publicar até cumprir os requisitos.

## Contratos que não podem regredir

- `turma_disciplinas` prova atribuição; horário publicado não cria atribuição formal.
- Professor excluído ou sem perfil acessível continua com vínculo registado, apresentado como vínculo não resolvido, nunca “não vinculado”.
- Matriz curricular inativa permanece contextualizada na versão histórica; não misturar versões como se fossem duas matrizes atuais.
- Contagens em consultas parciais são limites inferiores, não zeros definitivos.
- Ano letivo é identificado por UUID; não derivar vínculos apenas de coincidência Curso/Classe.
- Nenhum ajuste de explorador altera pagamentos, propinas, RLS, dados académicos ou histórico fiscal.

## Relação com o backlog Command Center

Este documento é um **adendo** ao `docs/command-center/estado-backlog-20261022.md`, não substitui CC-001–020. CC-002/003/004 (RLS, polos e E2E real), CC-012 (retorno de contexto), CC-015/016 (performance), CC-018/019 (acessibilidade/homologação) permanecem gates ou trabalhos independentes conforme o seu escopo. Não reclassificar os CC como concluídos por causa dos testes EX.

**Próxima ação:** EX-REL-01 → EX-REL-02 → EX-REL-03 → EX-REL-04 → EX-REL-05.
