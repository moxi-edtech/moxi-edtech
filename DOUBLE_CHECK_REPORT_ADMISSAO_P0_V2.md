# Double Check Report V2: Admissão Unificada (P0 Hardening)

## 1. Tabela de Rotas (Status Pós-Hardening)

### Rotas Canônicas (Novas)
| Rota | Status | Observação |
| :--- | :--- | :--- |
| `/api/secretaria/admissoes/radar` | ✅ **ACTIVE** | Funcional. Usa autorização `requireRoleInSchool`. |
| `/api/secretaria/admissoes/draft` | ✅ **ACTIVE** | Funcional. Usa autorização `requireRoleInSchool`. |
| `/api/secretaria/admissoes/vagas` | ✅ **ACTIVE** | Funcional. Usa autorização `requireRoleInSchool`. |
| `/api/secretaria/admissoes/convert`| ✅ **ACTIVE** | **ÚNICO** caminho de conversão canônico. Idempotente. Usa autorização `requireRoleInSchool`. |
| `/api/secretaria/admissoes/save_for_later`| ✅ **ACTIVE** | Lógica de "claim" otimista implementada. Usa autorização `requireRoleInSchool`. |
| `/api/secretaria/admissoes/lead` | ✅ **ACTIVE** | Endpoint seguro (auth-before-payload) para carregar leads. |

### Rotas Legadas
| Rota | Status | Observação |
| :--- | :--- | :--- |
| `/api/secretaria/candidaturas/[id]/confirmar` | ☠️ **GONE** | **Neutralizada.** Retorna `410 Gone`. O risco de conversão paralela foi eliminado. |
| `/secretaria/alunos/novo` (UI link) | ✅ **REDIRECTED** | O botão "Novo Aluno" em `/secretaria/alunos` agora aponta para o novo wizard (`/secretaria/matriculas/nova`). |
| `/financeiro/candidaturas` (UI) | ⚠️ **MITIGATED** | A UI do financeiro agora recebe um erro 410 e exibe uma mensagem clara sobre o fluxo ter sido migrado. |

## 2. E2E Walk-in (Pós-Hardening)
1. **`+ Nova Admissão`**: Abre o Wizard em branco.
2. **Step 1**: Dados preenchidos, `admissao_upsert_draft` chamado em background, `candidaturaId` criado. **Garantia de save no "Avançar" implementada.**
3. **Step 2**: Seleção de curso/classe, `vagas` API é chamada, turmas reais são exibidas. Seleciona turma, `draft` é atualizado.
4. **Step 3**: Escolhe "Pagar Agora", preenche dados, chama `admissao_convert`.
5. **Resultado**: `matricula` criada, `mensalidade` (dívida) de matrícula gerada, `pagamento` registrado. `outbox_events` e `audit_logs` criados.
6. **Retry**: Nova chamada com mesmo `idempotency-key` retorna o resultado da primeira chamada sem criar duplicados.
   - **Confiança**: Alta.

## 3. E2E Digital (Pós-Hardening)
1. **Lead Online**: Aparece no Radar (status `NOVOS_ONLINE`).
2. **Abrir Lead**: Ao clicar, URL `/secretaria/matriculas/nova?candidaturaId=<uuid>` é chamada.
3. **Wizard Hidratado**: `AdmissaoWizardClient` detecta o `candidaturaId`, chama `GET /api/secretaria/admissoes/lead?id=<uuid>`, e preenche os formulários dos Steps 1 e 2 com os dados do lead.
4. **Alteração**: Se a secretária altera um campo, o auto-save (draft) atualiza a `candidatura` existente.
5. **Step 3 - Pay Later**: Chama `save_for_later`.
6. **Resultado**: PDF real é gerado e guardado no Storage, `candidatura` atualizada para `AGUARDANDO_PAGAMENTO` com `expires_at` e `ficha_pdf_path`. Retorna URL assinada para o PDF. Chamada repetida retorna a mesma URL sem recriar o PDF.
   - **Confiança**: Alta.

## 4. Invariants Confirmados
- **✅ Sem `service_role` nas rotas da secretaria**: Confirmado.
- **✅ `pay later` não cria matrícula**: Confirmado. Apenas atualiza o status da `candidatura`.
- **✅ Conversão canônica única**: Confirmado. A rota legada `.../confirmar` retorna `410 Gone`. O único caminho de conversão é via `admissao_convert` RPC.

## 5. Diffs Relevantes

### `AdmissaoWizardClient.tsx`
- **O quê**: Adicionado tratamento de erros com feedback para o usuário e botão de "Tentar Novamente" nos Steps 1 e 2. Implementado "flush" do rascunho ao clicar em "Avançar".
- **Por quê**: Para melhorar a robustez da UI e garantir que o usuário não perca dados nem fique "preso" sem feedback.

### `/api/secretaria/candidaturas/[id]/confirmar/route.ts`
- **O quê**: Rota completamente substituída para retornar `410 Gone`.
- **Por quê**: Para eliminar imediatamente o risco crítico de uma lógica de conversão paralela e conflitante.

### `AlunosListClient.tsx`
- **O quê**: O `href` do botão "Novo Aluno" foi alterado para `/secretaria/matriculas/nova`.
- **Por quê**: Para direcionar o fluxo de criação de alunos para o novo wizard canônico.

### `FinanceiroCandidaturasInbox.tsx`
- **O quê**: Adicionado tratamento para o status `410` da API, mostrando um erro específico para o usuário.
- **Por quê**: Para informar o usuário do portal financeiro que o fluxo mudou, em vez de apresentar um erro genérico.