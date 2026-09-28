# Integração KLASSE para ChatGPT/Codex

Integração read-only publicada pelo app Next.js e executada pelo Supabase com o JWT do usuário. Nenhum endpoint aceita `school_id`/`escola_id`; a escola ativa é derivada de `auth.uid()` e de `escola_users`.

## Autenticação

Envie `Authorization: Bearer <supabase_access_token>`. A rota valida o token com `auth.getUser`, confirma a associação do usuário e chama uma RPC com o mesmo JWT. Não use nem distribua `service_role`.

O manifesto legado está em `/.well-known/ai-plugin.json` e o contrato OpenAPI em `/.well-known/klasse-openapi.yaml`. Para um GPT/Action, configure autenticação Bearer do usuário. O token expira segundo a política do Supabase (localmente, 3600 segundos); obtenha um token novo pela sessão normal do KLASSE.

## Ferramentas

| Tool | RPC | Papel mínimo |
|---|---|---|
| `buscar_aluno` | `klasse_search_students` | secretaria/financeiro/admin |
| `listar_inadimplencia` | `klasse_list_overdue_students` | financeiro/secretaria/admin |
| `resumo_financeiro` | `klasse_financial_summary` | financeiro/secretaria/admin |
| `professores_com_notas` | `klasse_teachers_with_grades` | secretaria/admin |
| `frequencia_turma` | `klasse_class_attendance` | professor/secretaria/admin |
| `situacao_academica_aluno` | `klasse_student_academic_status` | professor/secretaria/admin |

Todos os endpoints são `POST /api/integrations/chatgpt/{tool}`, têm `Cache-Control: private, no-store` e validam payloads com Zod. Os limites máximos são 25 resultados para busca e 50 para inadimplência.

## Variáveis de ambiente

- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Compatibilidade temporária: `SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`

Somente a chave pública é usada pela integração. `SUPABASE_SERVICE_ROLE_KEY` é proibida neste fluxo.

## Teste de isolamento

1. Aplique a migration em ambiente controlado.
2. Crie `user_a` vinculado apenas à escola A e `user_b` vinculado apenas à escola B.
3. Com o JWT de A, busque um aluno exclusivo de A: deve retornar o aluno.
4. Com o JWT de A, envie o `student_id` e o `class_id` exclusivos de B: ambas as respostas devem ter `data: []`.
5. Repita de forma inversa com o JWT de B.
6. Chame cada endpoint sem JWT e com JWT expirado: ambos devem retornar 401.
7. Use um professor para a consulta financeira: deve retornar 403/sem permissão.
8. Confirme que nenhum payload ou URL contém `school_id`/`escola_id` e execute os advisors do Supabase antes da promoção.

Esses testes precisam usar dois tenants reais de teste. A inspeção estática não substitui a prova no banco hospedado.

