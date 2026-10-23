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
