## Resumo das Novas Funcionalidades

- **Fluxo de Importação Híbrido (v4)**: O wizard de importação agora suporta dois modos: `migracao` (para alunos existentes) e `onboarding` (para novos candidatos). Em modo `migracao`, o sistema cria `turmas` como `'rascunho'` e `matriculas` como `'pendente'`, aguardando aprovação.

- **Aprovação Centralizada e Implícita**: A página de "Gestão de Turmas" agora é o ponto central para ativação. Ao aprovar uma turma em `'rascunho'`, o sistema automaticamente:
    1.  **"Materializa" o Curso**: Cria (ou aprova) o curso inferido do código da turma.
    2.  **Ativa a Turma**: Muda o status da turma para `'aprovado'`.
    3.  **Ativa as Matrículas**: Converte todas as matrículas `'pendentes'` daquela turma para `'ativas'`, gerando o número de matrícula oficial.

- **"Escudo Financeiro" na Geração de Mensalidades**: A função `gerar_mensalidades_lote` foi atualizada para respeitar a `data_inicio_financeiro` definida na importação, evitando a geração de cobranças retroativas para alunos migrados.

- **Controle Manual de Geração de Mensalidades**: Foi adicionado um novo componente (`GerarMensalidadesDialog`) ao Dashboard Financeiro, permitindo que a equipe financeira dispare a geração de mensalidades em lote para um mês/ano específico.

- **Busca por Nº de Processo Legado**: Alunos importados mantêm seu número de processo antigo no campo `numero_processo_legado`, que agora é indexado e incluído na busca global, facilitando a transição para a secretaria.

- **Notificações Direcionadas**: O sistema continua a notificar os roles corretos (`admin`, `financeiro`) sobre ações que requerem sua atenção, como turmas em rascunho ou a conclusão de importações.

- **Conciliação Bancária Automatizada (Novo)**: Foi implementado um módulo completo de conciliação bancária para automatizar o processo de correspondência entre extratos bancários e pagamentos de mensalidades.
    *   **Importação de Extratos**: Nova API (`POST /api/financeiro/conciliacao/upload`) para upload e parsing de arquivos CSV/XLSX. Os dados são armazenados na nova tabela `financeiro_transacoes_importadas`, com RLS e auditoria.
    *   **Listagem de Transações**: API (`GET /api/financeiro/conciliacao/transacoes`) para exibir transações importadas, permitindo filtros por status.
    *   **Matching Automático**: API (`POST /api/financeiro/conciliacao/matching`) para sugerir correspondências entre transações bancárias e alunos/mensalidades pendentes, atualizando o status e a confiança do match.
    *   **Confirmação Atômica**: Nova RPC de banco de dados (`confirmar_conciliacao_transacao`) e API (`POST /api/financeiro/conciliacao/confirmar`) para validar e registrar a conciliação. Isso atualiza o status da transação importada, marca a mensalidade como paga e cria um lançamento financeiro oficial.
    *   **Interface Dedicada**: Página `/financeiro/conciliacao` com UI intuitiva para todo o fluxo (upload, visualização, matching, confirmação).
    *   **Benefícios**: Reduz a entrada manual, minimiza erros, acelera a confirmação de pagamentos e garante a integridade dos dados financeiros.

## Sessão — Auditoria P0 + Correções (2026-02-02)

- **Auditoria completa (DB remoto + código)**: conferência de MVs, wrappers `vw_*`, cron jobs, RPCs, cache e multi-tenant, com relatórios atualizados em `agents/outputs/REPORT_SCAN.md` e `agents/ACADEMIC_REPORT_SCAN.md`.
- **Nova migration P0 aplicada**: `supabase/migrations/20260202000000_klasse_p0_compliance_fixes.sql` com novas MVs, views `vw_*`, cron de refresh e RPCs seguras (`admin_list_profiles`, `admin_profiles_by_ids`, `tenant_profiles_by_ids`).
- **Rotas críticas ajustadas**: `/api/financeiro/relatorios/propinas` passou a usar `vw_financeiro_propinas_por_turma`; rotas de escolas/admin agora usam `resolveEscolaIdForUser` e `vw_escola_info`.
- **Cache crítico corrigido**: removido `force-cache` em fluxos de Secretaria/Professor e trocado por `no-store`.
- **Profiles securizados**: leituras com `.in('user_id', ...)` substituídas por RPCs seguras em rotas da secretaria, escolas e super-admin.
- **Limites de payload reduzidos**: `defaultLimit` padronizado para `50` nas APIs.
