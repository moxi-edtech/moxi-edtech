# CC-003 — isolamento escola/polo: barreira P0

**Estado:** PR de segurança empilhada sobre #248; sem merge, migração ou deploy.
**CC-001:** frente paralela do proprietário, intocada.

## Diagnóstico confirmado em metadados do Supabase (read-only)
A base instalada não possui vínculo canónico utilizador↔polo↔turma/matrícula.
`escola_users`, `turmas`, `matriculas` e `alunos` não têm `polo_id`.
A flag comercial `app_plan_limits.multi_campus` não representa autorização.
Antes desta PR, omitir `poloId` permitia consultas da escola toda à Secretaria.

## Regra conservadora até existir modelo canónico
- Só admin, admin_escola, staff_admin, diretor (valor actual e canónico
  de `escola_users.papel`) ou super-admin validado por RPC podem consultar
  o Command Center sem escopo de polo.
- Secretaria, funções financeiras e outros perfis restritos são negados,
  mesmo quando não fornecem parâmetro de polo.
- `poloId`/`polo_id` explícito, inclusive vazio, é negado a todos
  até existir filtro por registo realmente seguro.
- Nove endpoints com a mesma guarda **depois** dos checks de sessão,
  escola e perfil e **antes** de aceder a dados. Uma migration versionada
  reforça a guarda na RPC operacional; RPCs antigas têm EXECUTE revogado
  a authenticated para evitar bypass direto via PostgREST.
- Não confiar em JWT user_metadata, URL, role legado ou cache como
  fonte de autorização. Sem alteração de RLS existente ou do financeiro.

## Ainda NÃO homologado
1. O modelo canónico de polos precisa de associação por escola, vínculo
   operador↔polo e turma↔polo, com tratamento explícito de transferências
   e histórico; aprovação de domínio antes de criar migrations.
2. Implementar RLS que nega escrita/leitura cruzada entre polos P1/P2 na
   mesma escola e escolas A/B, sem filtrar apenas no cliente.
3. Testar GoTrue autenticado e chamadas RPC diretas, pesquisa global,
   demais endpoints legados, cache/recentes, três atendimentos, logout.
4. Reconciliar #213/#216/#232/#235 e CC-001 e confirmar ausência de
   regressões antes da produção.

**Esta PR é contenção do Command Center, não prova de isolamento
multi-polo para todo o SaaS. Não autoriza deploy.**
