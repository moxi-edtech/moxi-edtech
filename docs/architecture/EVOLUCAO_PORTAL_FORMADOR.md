# Evolução Portal do Formador — Relatório de Progresso

**Data:** 2026-05-05  
**Projecto:** Klasse Formação  
**Status:** Fase 5 Concluída (Comunicação e Certificação)

---

## 1. O que foi Implementado

### 1.1 Backend & Segurança (RLS-Level Logic)
- **Helper `assertCohortAccess`:** Implementado em `@/lib/route-auth.ts`. Este mecanismo garante que formadores apenas acedam a turmas (`cohorts`) onde estão explicitamente vinculados na tabela `formacao_cohort_formadores`.
- **Hardening de APIs:** As rotas abaixo foram abertas para o papel `formador` com validação de vínculo:
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/aulas`
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/aulas/[aulaId]/presencas`
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/avaliacoes`
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/avaliacoes/agenda`
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/materiais`
  - `GET/POST /api/formacao/backoffice/cohorts/[id]/avisos` (Novo: Fase 5)
  - `PATCH /api/formacao/backoffice/cohorts/[id]` (Relatório Pedagógico: Fase 5)
  - `PATCH /api/formacao/backoffice/cohorts/[id]/formandos/[userId]/recomendacao` (Fase 5)
  - `GET /api/formacao/backoffice/cohorts/[id]` (Detalhes da turma)
- **Privacidade Financeira:** A API de detalhes da turma foi modificada para ocultar o objecto `finance` e `valor_referencia` quando o utilizador tem o papel `formador`.

### 1.2 Interface do Diário de Turma (Fase 1, 3, 4 & 5)
- **Novo Componente:** `FormadorCohortJournal.tsx` criado em `@/components/pedagogico/`.
- **Nova Rota:** `/formador/turma/[id]` actua como o cockpit pedagógico do formador.
- **Funcionalidades Activas:**
  - **Lançamento de Sumários:** Registo de data, horas ministradas e conteúdo realizado.
  - **Controlo de Presenças:** Interface rápida (modal) para marcar presença/falta dos inscritos.
  - **Agenda de Avaliações:** Interface para agendar testes e exames por módulo.
  - **Materiais de Apoio (Upload):** Suporte para upload directo de ficheiros (PDF, Slides) para o bucket `formacao-assets`.
  - **Mensagens de Turma (Fase 5):** Canal de avisos do formador para os alunos.
  - **Recomendação de Certificação (Fase 5):** Toggle para indicar à secretaria quais alunos estão aptos para certificar.
  - **Relatório Pedagógico Final (Fase 5):** Campo para balanço final da turma.

### 1.3 Portal do Aluno (Fase 4)
- **Detalhes do Curso:** Nova rota `/meus-cursos/[id]` que permite ao formando visualizar o calendário de avaliações e descarregar os materiais de apoio disponibilizados pelo formador.

### 1.4 Gestão de Desempenho & Alertas (Fase 2)
- **Lançamento de Notas Numéricas:** Adicionado campo para inserção de notas (0-20) na pauta de avaliações.
- **Observações Pedagógicas:** Ícone de mensagem para adicionar comentários individuais por módulo/estudante.
- **Alertas de Risco de Assiduidade:**
  - Banner de alerta no topo da pauta e da lista de alunos quando existem estudantes abaixo de 75% de presença.
  - Destaque visual (cor de fundo e ícone de perigo) nas linhas de alunos em risco.
  - Sincronização em tempo real do cálculo de risco baseado nos sumários realizados.

### 1.5 Automação (Fase 3)
- **Sincronização Aula -> Honorário:** Implementado via trigger de base de dados (`tr_formacao_sync_aula_to_honorario`). Quando uma aula é marcada como "Realizada", um rascunho de honorário é gerado automaticamente com base no `valor_hora` configurado para o formador naquela turma.

---

## 2. Backlog de Evolução (Próximas Fases)

### Fase 6: Analytics e Feedback
- [ ] **Feedback de Alunos:** Visualização pelo formador das avaliações anónimas da turma.
- [ ] **Gráfico de Evolução:** Visualização da média de notas vs. média de assiduidade por módulo.

---

## 3. Notas Técnicas
- **Bucket `formacao-assets`:** Configurado para aceitar PDF, Imagens e WebP até 10MB.
- **Trigger de Honorários:** O rascunho de honorário utiliza a referência `AUTO-[AULA_ID]` para evitar duplicidade.
- **Segurança de Materiais:** As políticas de RLS garantem que apenas formadores da turma ou admins possam gerir os ficheiros de suporte.
