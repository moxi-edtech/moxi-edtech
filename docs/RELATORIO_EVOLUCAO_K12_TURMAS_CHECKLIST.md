# Roadmap de Evolução: Gestão de Turmas K12

Este documento detalha o plano de evolução para a listagem e gestão de turmas no portal administrativo/secretaria, visando aumentar a eficiência operacional e a visão pedagógica.

## 🟢 Fase 1: Quick Wins & UX (Eficiência Imediata)
Focada em reduzir cliques e melhorar a visibilidade de informações sem sair da lista.

- [x] **Implementar Quick View (Linha Expandida)**
    - [x] Substituir o placeholder por um resumo real na `TurmaRow`.
    - [x] Mostrar Top 3 alunos em risco (faltas/notas).
    - [x] Mostrar disciplina/professor atual (baseado no horário).
- [x] **Edição Rápida (Inline Editing)**
    - [x] Permitir alteração rápida de `Sala` e `Capacidade Máxima` diretamente na tabela.
    - [x] Feedback visual de "Salvando..." na linha.
- [x] **Melhoria no Filtro de Busca**
    - [x] Adicionar busca por nome de professor e sala (atualmente focado no nome da turma/curso).

## 📝 Resumo das Alterações (Fase 1)
- **Frontend:**
    - Atualizado `TurmasListClient.tsx` com estados para `editingCell`, `expandedData` e lógica de fetch on-demand.
    - `TurmaRow` agora suporta inputs inline com salvamento ao perder o foco (onBlur) ou pressionar Enter.
    - Nova coluna "Cap." adicionada à tabela administrativa.
    - Lógica de busca expandida para incluir metadados de professores e salas.
- **Backend (APIs):**
    - `PATCH /api/escolas/[id]/turmas/[turmaId]`: Endpoint genérico para atualizações parciais.
    - `GET /api/escola/[id]/admin/turmas/[turmaId]/quick-view`: Agregador de dados de risco e horário atual.


## 🟡 Fase 2: Saúde Pedagógica & Dados (Visão Analítica)
Transformar a lista de uma ferramenta administrativa em um dashboard de sucesso do aluno.

- [x] **Expandir `HealthSignal` (Saúde Pedagógica)**
    - [x] Criar novo RPC ou endpoint para buscar média de assiduidade e performance por turma.
    - [x] Integrar lógica de "Atenção" se assiduidade < 75% ou média < 50%.
    - [x] Atualizar componente `HealthBadge` e `HealthDetail`.
- [x] **Tooltips Detalhados de Saúde**
    - [x] Mostrar decomposição do sinal (ex: "Saúde Crítica: 3 alunos inadimplentes, 15% de faltas acumuladas").
- [x] **Indicador de "Turma Desescoberta"**
    - [x] Alerta visual se o horário prevê aula mas não há professor atribuído ou o professor marcou falta.

## 🟠 Fase 3: Operações em Massa & Comunicação (Escalabilidade)
Facilitar o trabalho da secretaria em períodos de pico (início/fim de trimestre).

- [x] **Seleção em Massa (Bulk Actions)**
    - [x] Adicionar checkboxes na tabela de turmas.
    - [x] Ação: **Impressão em Lote** (Gerar PDFs de Lista Nominal para N turmas).
    - [x] Ação: **Fechamento de Período em Bloco** (Para turmas de um mesmo curso).
- [x] **Comunicação Integrada**
    - [x] Botão para "Notificar Encarregados" da turma (via Push/Email) diretamente da lista.
    - [x] Exemplos: Avisos de reuniões, feriados ou ocorrências coletivas.

## 📝 Resumo das Alterações (Fase 3)
- **Frontend:**
    - Adicionado suporte a seleção múltipla (`selectedIds`) no `TurmasListClient.tsx`.
    - `TurmaRow` e `SecretaryCardView` agora exibem checkboxes e respondem ao estado de seleção.
    - Implementada barra de ações em massa flutuante (Bulk Actions Bar) com atalhos para Impressão, Fechamento e Notificação.
    - Integração com API de fecho individual para processamento em lote.
- **Backend (APIs):**
    - `POST /api/escola/[id]/admin/turmas/bulk-print`: Novo endpoint para orquestração de documentos em lote (Lista Nominal) via Inngest.


## 🔵 Fase 4: Integração com Ecossistema (Visão 360º)
Conectar a gestão de turmas com admissões e RH.

- [x] **Integração com Funil de Admissão**
    - [x] Mostrar contagem de "Candidatos em Espera" para turmas com vagas abertas.
    - [x] Link direto para converter candidaturas em matrículas para aquela turma específica.
- [x] **Gestão de Substituições**
    - [x] Interface rápida para atribuir "Professor Substituto do Dia" quando o titular falta.
- [x] **Log de Ocupação Histórica**
    - [x] Visualizar evolução da lotação da turma ao longo do ano.

## 📝 Resumo das Alterações (Fase 4)
- **Frontend:**
    - `TurmasListClient.tsx` atualizado para exibir contagem de candidatos em espera e evolução histórica de ocupação no Quick View.
    - Interface de substituição rápida adicionada à "Aula Atual" no Quick View.
    - `AdmissoesInboxClient.tsx` aprimorado para suportar filtros de `turmaId` via URL.
- **Backend (APIs & DB):**
    - Nova tabela `substituicoes_professores` para gestão de faltas docentes.
    - RPC `get_turmas_pedagogico_stats` expandido para incluir métricas de admissão.
    - Novo RPC e API `historico-ocupacao` para gerar snapshots mensais de lotação.
    - Nova API `substituicoes` para gravação de substitutos temporários.
    - API de `radar` de admissões atualizada com filtro por `turmaId`.

---

## 🛠️ Notas de Implementação Técnica

### Componentes Chave
- `TurmasListClient.tsx`: Orquestrador principal da lista.
- `TurmaRow.tsx`: Componente de linha individual (precisa de otimização para inline editing).
- `HealthDetail.tsx`: Lógica centralizada de sinais de alerta.

### Novas APIs Necessárias
- `GET /api/escola/[id]/admin/turmas/stats-pedagogicos`: Para buscar assiduidade e médias.
- `PATCH /api/escola/[id]/admin/turmas/[turmaId]`: Endpoint genérico para atualizações rápidas.
- `POST /api/escola/[id]/admin/turmas/bulk-print`: Orquestração de PDFs em lote.
