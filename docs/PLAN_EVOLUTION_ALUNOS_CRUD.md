# Plano de Evolução: CRUD de Alunos (Portal Secretaria)

Este documento detalha o plano de ataque para resolver o erro 404 na edição de alunos, garantir a persistência real dos dados e evoluir a experiência do usuário (UX) no portal da secretaria.

## 1. Fase 1: Resolução do Erro 404 (Rotas Multi-tenant)

O erro ocorre devido à falta do arquivo de página na estrutura de rotas baseada em `escola/[id]`.

### Ações:
- [ ] **Criar Rota Proxy**: Implementar `apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/alunos/[alunoId]/editar/page.tsx`.
- [ ] **Ajustar Componente Base**: Modificar o componente `EditarAlunoPage` em `apps/web/src/app/secretaria/(portal-secretaria)/alunos/[id]/editar/page.tsx` para aceitar `alunoId` via props ou detectar dinamicamente `params.alunoId` vs `params.id`.

## 2. Fase 2: Robustez da Persistência (API e Backend)

Garantir que todos os campos editáveis no formulário sejam persistidos corretamente e que as regras de negócio sejam respeitadas.

### Ações:
- [ ] **Revisão do Schema (Zod)**: Atualizar o `UpdateSchema` em `apps/web/src/app/api/secretaria/alunos/[id]/route.ts` para incluir todos os campos (ex: `nif`, `endereco`, `responsavel_financeiro`, etc).
- [ ] **Sincronização com Profiles**: Garantir que alterações em campos comuns (nome, email, telefone) reflitam na tabela `profiles` via `PATCH`.
- [ ] **Auditoria**: Verificar se o `recordAuditServer` está capturando o estado anterior e novo para rastreabilidade de alterações.
- [ ] **Segurança (RLS)**: Validar se o `escola_id` do aluno corresponde ao `current_escola_id` do usuário da secretaria no momento do `PATCH`.

## 3. Fase 3: Evolução de UI/UX (Frontend Moderno)

Transformar o formulário monolítico em uma interface dividida por contextos e com validação robusta.

### Ações:
- [ ] **Refatoração com React Hook Form**: Migrar o estado local para `react-hook-form` + `zodResolver`.
- [ ] **Interface por Abas (Contextos)**:
    - **Aba 1: Identificação**: Nome, Nascimento, Sexo, Naturalidade, Filiação.
    - **Aba 2: Documentação**: BI, NIF, Passaporte.
    - **Aba 3: Contactos**: Email, Telefone, Endereço.
    - **Aba 4: Encarregado/Financeiro**: Dados do responsável e dados de faturação.
- [ ] **Feedback em Tempo Real**: Adicionar validações de campo (ex: formato de email, obrigatoriedade de nome) antes do submit.
- [ ] **Toasts de Notificação**: Substituir alertas simples por componentes de notificação (`sonner` ou `toast`).

## 4. Cronograma Sugerido

| Fase | Descrição | Prioridade |
| :--- | :--- | :--- |
| **P0** | Correção do 404 e mapeamento de rotas | Imediata |
| **P1** | Sincronização Total API (Campos faltantes) | Alta |
| **P2** | Refatoração de UI (Abas + Validação) | Média |

---
*Documento gerado para guiar a implementação da sprint de melhoria da Secretaria.*
