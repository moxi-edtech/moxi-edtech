# Relatório Executivo: Evolução do Quadro de Horário & Onboarding (K12)
**Data:** 5 de Maio de 2026
**Contexto:** apps/web (Portal Admin & Portal Aluno)

## 1. Evolução Técnica do Quadro de Horários (Timetable)
O sistema de horários foi otimizado para suportar operações de larga escala e detecção inteligente de erros.

### Melhorias Implementadas:
- **Consolidação de Regras (`scheduler-rules.ts`):** Unificação da lógica de validação. O sistema agora diferencia conflitos "Hard" (bloqueantes, ex: colisão de professor/sala) de conflitos "Soft" (avisos pedagógicos).
- **Performance de Renderização:** Refatoração completa do `SchedulerBoard.tsx` com memoização de sub-componentes (`GridRow`, `AulaCard`, `StatusAlerts`). O arrasto de disciplinas agora é fluido mesmo em grades densas.
- **Validação em Tempo Real:** Implementação de detecção local de conflitos. O utilizador recebe feedback visual imediato (ícone de alerta) ao tentar alocar um professor ou sala já ocupados em outra turma.

## 2. Reestruturação do Onboarding da Escola
O processo de setup inicial foi transformado de um wizard meramente acadêmico para um fluxo de ativação operacional completo.

### Melhorias Implementadas:
- **Passo Financeiro Integrado:** Inclusão de preçário base (inscrição e mensalidades) e IBAN logo no onboarding. A escola já nasce pronta para faturar.
- **Onboarding Expresso (Modo Rápido):** Botão "Configuração Rápida" que preenche o sistema com padrões do Ministério da Educação (Regime Trimestral) e valores base, reduzindo o "Time-to-Value" para segundos.
- **Identidade Visual:** Adição de upload de logótipo no primeiro passo, aumentando o engagement emocional do gestor ao ver a sua marca no sistema desde o início.
- **Dinamização de Dados Bancários:** O IBAN configurado no onboarding agora é propagado automaticamente para:
    - Portal do Aluno (Drawer de Pagamento).
    - Ficha de Inscrição em PDF.
    - Página de Impressão de Candidaturas.

## 3. Checklist de Ativação (Pós-Wizard)
Substituição da seção acadêmica estática do Dashboard por um **Widget de Ativação da Escola**.

- **Barra de Progresso Operacional:** Exibe a % de prontidão da escola.
- **Guia de Próximos Passos:** Links contextuais para:
    1. Estrutura Acadêmica (Setup).
    2. Preçário & IBAN (Financeiro).
    3. Equipa Docente (Convidar Professores).
    4. Primeiros Alunos (Importação/Matrícula).
    5. Configuração Fiscal (Regime de IVA).

---

## 4. Backlog de Evolução (Próximas Prioridades)

### Alta Prioridade (UX & Operacional)
- [ ] **Undo/Redo no Quadro de Horários:** Histórico de ações (Ctrl+Z) para evitar perda de trabalho em edições complexas.
- [ ] **Wizard de Importação de Alunos:** Criar um passo guiado para upload de CSV de alunos, integrado na nova Checklist.
- [ ] **Visão do Professor/Sala:** Alternar visualização da grade de horários para focar num docente ou numa sala específica.

### Médias & Futuras (Inteligência)
- [ ] **Sugestão de Slots Ideais:** Destacar slots livres/recomendados ao começar o drag de uma disciplina no quadro.
- [ ] **Auto-Save de Onboarding:** Persistir rascunhos de onboarding em cada campo preenchido (tabela `onboarding_drafts`).
- [ ] **Integração Fiscal Real:** Ligar a checklist de ativação fiscal ao status de certificação da AGT.

---
**Status da Sessão:** Concluída com sucesso. Código estável e tipado (TypeScript Strict).
