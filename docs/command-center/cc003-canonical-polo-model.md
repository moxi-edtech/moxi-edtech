# CC-003 — modelo canónico de polos: ativação opt-in e fail-closed

Dependência: PR #250. **Não aplicar migrations ou ativar escola em produção antes da homologação autenticada.**

O modelo introduz `escola_polos` (unidade vinculada a um único tenant), `escola_user_polos` (operadores com 1..N unidades autorizadas), `escola_turma_polos` (alocação exclusiva por turma/ano) e a tabela privada `cc_security.enforced_schools`. Não realiza backfill ou atribuições a utilizadores atuais.

As RLS **restritivas** para `turmas`, `matriculas` e `alunos` intersectam as políticas existentes para todas as operações, inclusive Data API. Sem ativação a escola mantém o comportamento anterior. Com ativação, operador restrito apenas lê turmas do seu polo e alunos com matrícula ativa inequívoca no polo; falta de alocação ou múltiplas matrículas ativas em polos diferentes bloqueia o aluno. Administradores institucionais não contornam o isolamento entre escolas, que permanece coberto pela política permissiva do tenant.

A migração exige revisão em réplica fiel. As políticas por `alunos` podem bloquear inserções antes de vincular matrícula, consultas de encarregados e fluxos históricos quando ativadas. Não ativar sem desenhar estes casos e revalidar contratos financeiros, portal do aluno, Balcão e transferências de turma. Novas tabelas são somente de leitura para utilizadores; o provisionamento exige serviço autorizado.

## Gates de produção

- Homologação humana de polos por escola, operador e turma/ano; **nunca inferir vínculos dos nomes**.
- Testes completos de Auth/GoTrue, RLS e RPC diretamente; manter duas escolas e dois polos, também durante transferência e rematrícula.
- Inventário de views definer e funções com bypass RLS, especialmente `search_global_entities`; não prometer segurança de ponta a ponta enquanto houver caminhos não protegidos.
- Replay estrutural da base instalada, EXPLAIN e medição antes/depois sob cardinalidade real; revisar funções por linha em `allowed_aluno`.
- Só habilitar a escola por `cc_security.enforced_schools` após migração verificável, provisionamento auditado e plano de reversão.

**Status:** fundação versionada e teste PostgreSQL sintético, não isolamento integral homologado, sem alteração na produção.


## Registo de release — 23 de outubro de 2026

**Política de publicação:** o modelo foi testado em PostgreSQL sintético, mas não homologado com a estrutura e dados históricos completos. A presença do esquema e das políticas não significa isolamento por polo ativo. Enquanto `cc_security.enforced_schools` não tiver uma escola com `enabled=true`, os predicados do CC-003 opt-in não alteram a visibilidade anterior de utilizadores autenticados. **Não ativar a flag no banco de produção sem os gates acima.**

**Dependências Git:** a PR #251 empilha a #250, que por sua vez empilha a #248, pertencente à cadeia maior de Command Center. Ao direcionar diretamente para main, auditar os ficheiros de todas as PRs intermediárias e os efeitos de migrations. Não confundir CI verde desta branch com validação de toda a cadeia.

**Plano de implantação:** versão de aplicação → migrações apenas se validadas na réplica fiel → smoke tests autenticados com perfis reais → habilitar uma escola piloto somente após aprovação dos vínculos canónicos. A reversão operacional preferida é `UPDATE cc_security.enforced_schools SET enabled=false WHERE escola_id = <escola_id>`, executada apenas por um operador privilegiado. A reversão do schema ou da aplicação é processo separado.

**Critério de bloqueio:** a exigência de reproduzir o estado do banco de produção, auditar `SECURITY DEFINER`, preservar compatibilidade de fluxos financeiros/portais e demonstrar RLS real impede afirmar prontidão para produção apenas com testes sintéticos.
