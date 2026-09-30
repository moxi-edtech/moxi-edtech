# Integração KLASSE para ChatGPT/Codex

Integração publicada pelo app Next.js e executada pelo Supabase com o JWT do usuário. Oferece consultas e operações de escrita controladas. Nenhum endpoint aceita `school_id`/`escola_id`; a escola ativa é derivada de `auth.uid()` e de `escola_users`.

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
| `lancar_frequencia` | `klasse_record_attendance` | professor/admin |
| `lancar_notas` | `klasse_record_grades` | professor/secretaria/admin |
| `preparar_pagamento` | `klasse_prepare_payment` | financeiro/secretaria/admin |
| `confirmar_pagamento` | `klasse_confirm_payment` | financeiro/secretaria/admin |
| `confirmacoes_pendentes` | `klasse_pending_confirmations` | financeiro/secretaria/admin |

Todos os endpoints são `POST /api/integrations/chatgpt/{tool}`, têm `Cache-Control: private, no-store` e validam payloads com Zod. Os limites máximos são 25 resultados para busca e 50 para inadimplência.

### Regras de escrita

- Frequência e notas exigem confirmação do conteúdo pelo utilizador antes da chamada.
- Pagamentos são obrigatoriamente executados em dois tempos: `preparar_pagamento` calcula o saldo e cria um token sem cobrar; `confirmar_pagamento` só pode ser chamado depois de o utilizador confirmar explicitamente o resumo.
- O token de pagamento é pessoal, expira em 15 minutos e é idempotente: reutilizá-lo devolve o resultado anterior sem duplicar a cobrança.
- Todas as operações são auditadas e voltam a validar papel e tenant dentro do banco.

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
9. Prepare um pagamento de teste e confirme que nenhuma linha financeira é criada antes de `confirmar_pagamento`.
10. Confirme o pagamento, reenvie o mesmo token e valide que só existe um pagamento.
11. Tente lançar frequência, notas e pagamentos com papéis não autorizados e com IDs de outra escola: todas as tentativas devem ser recusadas.

Esses testes precisam usar dois tenants reais de teste. A inspeção estática não substitui a prova no banco hospedado.
