# Relatório de Verificação e Análise de Reaproveitamento

## 1. Árvore Canônica do Wizard de Admissão

O `AdmissaoWizardClient` é composto por três componentes internos que renderizam os formulários para cada passo:

- **Wizard Step 1 (Identificação):**
  - **Componente:** `Step1Identificacao` (definido em `AdmissaoWizardClient.tsx`)
  - **Lógica:** Renderiza inputs HTML básicos (`<input>`) para os dados do candidato.

- **Wizard Step 2 (Fit Acadêmico):**
  - **Componente:** `Step2FitAcademico` (definido em `AdmissaoWizardClient.tsx`)
  - **Lógica:** Renderiza selects HTML (`<select>`) para curso e classe, e uma lista de `divs` para as turmas.

- **Wizard Step 3 (Pagamento):**
  - **Componente:** `Step3Pagamento` (definido em `AdmissaoWizardClient.tsx`)
  - **Lógica:** Renderiza um `<select>` para o método de pagamento e `<input>` para os detalhes.

## 2. Veredito: Reaproveitamento vs. Recriação

- **Veredito:** **Recriado.**
- **Evidência:**
  - O componente `AdmissaoWizardClient` e seus sub-componentes (`Step1Identificacao`, etc.) são uma implementação nova e autocontida.
  - **Ausência de Imports Legados:** A análise de imports com `rg -n "from '.*(candidatura|matricula|aluno).*'"` no ficheiro do Wizard não retornou resultados. Isso prova que nenhum componente de formulário, hook ou helper de UI do sistema legado foi reaproveitado.
  - **Ausência de Zod Schemas:** A análise com `rg -n "zod|schema|z\.object"` não retornou resultados, indicando que o Wizard não importa schemas de validação legados, nem define novos. A validação é delegada para as novas rotas de API.
  - **Chamadas de API Canônicas:** O Wizard interage exclusivamente com os novos endpoints em `/api/secretaria/admissoes/*`, que por sua vez utilizam os novos RPCs. Não há chamadas para rotas ou funções legadas.

## 3. Alerta de Risco: Rotas Legadas Ativas

A análise da base de código revelou que, embora o novo Wizard não utilize código legado, várias rotas antigas que podem criar ou modificar dados de forma paralela ainda existem e estão ativas.

### Tabela de Risco
| Tela/Rota | Usa Form Novo ou Legado? | Cria o Quê? | Risco? | Ação Tomada / Sugestão |
| :--- | :--- | :--- | :--- | :--- |
| `/secretaria/matriculas/nova` (UI) | **Form Novo** (`AdmissaoWizardClient`) | `candidatura` (draft) | Não | **CANÔNICO** |
| `/secretaria/candidaturas/[id]/editar` (UI) | Form Legado | Edita `candidatura` | Sim | **NEUTRALIZADO (P0-4)**: Acesso restrito para a `secretaria`. |
| `/api/secretaria/candidaturas/[id]/confirmar` | N/A (API) | `matrícula` | **Sim (Alto)** | **NEUTRALIZADO (P0-1)**: Rota retorna `410 Gone`. |
| `/api/secretaria/alunos/novo` | Form Legado (na UI `alunos/novo/page.tsx`) | `candidatura` | **Sim (Médio)** | ⚠️ **LEGACY_RISK**: Esta rota continua a ser um caminho alternativo para criar uma `candidatura` (`status: 'pendente'`) que não passa pelo novo Wizard. **Sugestão**: Aplicar o mesmo tratamento de P0-4 (restringir por role e redirecionar para `/secretaria/matriculas`). |
| `/financeiro/candidaturas` (UI) | UI Legada (`FinanceiroCandidaturasInbox`) | N/A (confirma/rejeita) | **Sim (Médio)** | ⚠️ **LEGACY_RISK**: Esta UI ainda chama a rota legada de confirmação (que agora retorna 410). O portal financeiro precisa ser atualizado para usar o novo fluxo ou ter um fluxo próprio bem definido. **Sugestão**: Em P1, alinhar o fluxo do financeiro. Por agora, a ação de confirmação irá falhar, o que é um "fail-safe". |
