# E2E Checklist: Admissão Unificada (P0)

Este checklist destina-se a uma verificação manual rápida (15 minutos) para garantir que o fluxo principal de admissão está a funcionar como esperado.

## Cenário 1: Walk-in (Candidato Presencial)

**Objetivo:** Simular a chegada de um encarregado à secretaria para matricular um aluno.

| Passo | Ação | Resultado Esperado | Status (PASS/FAIL) |
| :-- | :--- | :--- | :--- |
| 1.1 | Navegar para `/secretaria/matriculas`. | O "Radar de Admissões" é exibido. | |
| 1.2 | Clicar em `+ Nova Admissão`. | O wizard de 3 passos abre no Passo 1 (Identificação). | |
| 1.3 | **Passo 1:** Preencher `nome`, `telefone` e `BI`. | Nenhum erro visível. O draft é salvo em background. | |
| 1.4 | Sair da página (ex: ir para o dashboard) e voltar para `/secretaria/matriculas`. | O novo candidato aparece na coluna "Em Análise" do Radar. | |
| 1.5 | Abrir o candidato a partir do Radar. | O wizard abre no Passo 1 com os dados preenchidos. | |
| 1.6 | Avançar para o **Passo 2 (Fit Acadêmico)**. | A UI para selecionar curso e classe é exibida. | |
| 1.7 | Selecionar um `Curso` e uma `Classe`. | A lista de turmas compatíveis é exibida, mostrando as vagas disponíveis. | |
| 1.8 | Selecionar uma `Turma`. | A turma é selecionada. O botão para avançar é habilitado. | |
| 1.9 | Avançar para o **Passo 3 (Momento da Verdade)**. | A UI de pagamento é exibida. | |
| 1.10| Preencher dados de pagamento (mock: `TPA`, valor `10000`). | Campos são preenchidos. | |
| 1.11| Clicar em `Matricular Definitivamente`. | A matrícula é confirmada com sucesso. Uma mensagem de sucesso é exibida. | |
| 1.12| Verificar `audit_logs` no Supabase. | Logs para `ADMISSION_DRAFT_SAVED`, `MATRICULA_CREATED`, `FINANCE_PAYMENT_CONFIRMED`, `ADMISSION_CONVERTED` foram criados. | |
| 1.13| Verificar a tabela `matriculas`. | Uma nova matrícula ativa foi criada para o aluno na turma correta. | |
| 1.14| Tentar submeter o mesmo pagamento novamente (retry). | O sistema deve impedir a duplicação, retornando um erro ou o resultado original (idempotência). | |


## Cenário 2: Digital (Candidato Online)

**Objetivo:** Simular o processo para um candidato que já se pré-inscreveu online.

| Passo | Ação | Resultado Esperado | Status (PASS/FAIL) |
| :-- | :--- | :--- | :--- |
| 2.1 | (Pré-condição) Criar uma candidatura com `status = 'NOVOS_ONLINE'`. | Candidatura existe no banco de dados. | |
| 2.2 | Navegar para `/secretaria/matriculas`. | O "Radar de Admissões" é exibido, com o novo candidato na coluna "Novos (Online)". | |
| 2.3 | Abrir o candidato a partir do Radar. | O wizard abre no Passo 1 com os dados do candidato online já preenchidos. | |
| 2.4 | Avançar para o **Passo 2 (Fit Acadêmico)** e selecionar uma turma. | Turma é selecionada. | |
| 2.5 | Avançar para o **Passo 3 (Momento da Verdade)**. | A UI de pagamento é exibida. | |
| 2.6 | Clicar em `Salvar Pré-inscrição`. | Uma mensagem de sucesso é exibida, e um link para o PDF (placeholder) é gerado. | |
| 2.7 | Voltar para o Radar (`/secretaria/matriculas`). | O candidato agora está na coluna "Aguardando Pagamento". | |
| 2.8 | Verificar a tabela `candidaturas`. | O status da candidatura é `AGUARDANDO_PAGAMENTO` e o campo `expires_at` está definido para 48h no futuro. | |
| 2.9 | Verificar `audit_logs` no Supabase. | Um log para `ADMISSION_RESERVED_48H` foi criado. | |

## Verificações Gerais

| Item | Critério de Aceite | Status (PASS/FAIL) |
| :-- | :--- | :--- |
| **Cross-Tenancy** | Um secretário de uma `escola_id` não consegue ver ou interagir com candidaturas de outra `escola_id`. | |
| **Performance do Radar** | O dashboard do radar deve carregar em menos de 1 segundo em condições normais. | |
| **Idempotência** | Repetir uma chamada `convert` ou `draft` não deve criar registros duplicados. | |
| **Audit Trail** | Todas as ações que mudam o estado de uma admissão geram um registo de auditoria correspondente. | |
| **Outbox Events**| (Se aplicável) Todas as ações que mudam o estado geram um evento no outbox. | |
