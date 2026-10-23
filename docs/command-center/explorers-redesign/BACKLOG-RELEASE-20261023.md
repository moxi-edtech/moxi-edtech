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
| EX-REL-01 | P0 | Pendente | Comparar migrations EX-005 (`20271015100001`) e EX-007 (`20271015100002`) com histórico e catálogo reais do Supabase, sem editar migrations já aplicadas. Registar plano e rollback. |
| EX-REL-02 | P0 | Pendente | Aplicar RPC `command_center_course_turmas_page` em ambiente controlado; validar `SECURITY INVOKER`, grants sem `anon`, isolamento entre escolas, paginação 1–50, contagem e erros 403/503. |
| EX-REL-03 | P0 | Pendente | Homologação autenticada de Secretaria e Direção, pelo menos duas escolas, ano corrente e histórico; >100 turmas, filtros, paginação, links, professor removido, vínculos legados, versão curricular inativa e dados parciais. |
| EX-REL-04 | P0 | Pendente | Revalidar #261 → #262, conflitos e CI no HEAD final de ambas; integrar em ordem, sem omitir gates de segurança/financeiro de outras frentes. |
| EX-REL-05 | P0 | Pendente | Deploy controlado, smoke tests autenticados dos cinco exploradores, observabilidade e rollback testado. |
| EX-QUAL-01 | P1 | Pendente | Medir p95, bytes, requisições e `EXPLAIN (ANALYZE, BUFFERS)` em estrutura representativa; confirmar índices e ausência de N+1. |
| EX-QUAL-02 | P1 | Pendente | Acessibilidade com teclado, foco, zoom e leitor de ecrã nas cinco vistas em sessão real. |
| EX-QUAL-03 | P1 | Pendente | Confirmar rótulos: vínculo não resolvido ≠ inexistente; ausência em recorte parcial ≠ ausência comprovada; versão curricular inativa ≠ versão duplicada. |

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
