# Horários — cutover da protecção transaccional

Estado: bloqueado para produção, 2026-11-24.

- PR #464 integrada; merge bbed42e8cb93e8e35ad95131bc160536b8c13099.
- app.klasse.ao serve e724f038a7bf3696d50f740f1b1655cd850c72b1 (PR #461). O consumidor antigo ainda grava versões publicadas; não instalar a regra draft-only antes de trocar a API e homologar.
- PostgreSQL 17.6: proposta isolada aprovada em fixtures sintéticas, não em todo o schema/RLS real.
- Auditoria de leitura: 573 aulas publicadas, 266 em turmas activas/anos activos, zero pares de conflitos activos, oito aulas com slot inválido (não currículo) em ESG-9-M-A (3), ESG-8-M-A (3), ENF-10ª Classe-M-A (2). Nenhuma pertence à escola Curtume. Não corrigir por inferência.
- Ledger remoto mais recente observado: 20271203005200_fecho_diario_rejeicao_responsaveis. O ficheiro com este nome não foi localizado na main; não reconciliar o ledger por suposição nem reutilizar versões. CLI indisponível no ambiente actual.
- Antes de versionar: confirmar ledger/repositório, gerar migration com CLI, alinhar permissões das RPCs com os papéis administrativos/secretaria e a autorização exacta do tenant, proteger log de eventos, rever chamadas directas a ensure/publish e escritores de atribuição docente. Cobrir alteração de tempos partilhados, ordem de locks e concorrência. Não transformar a proposta existente em migration executável sem estes testes.
- Sequência de release: API compatível em produção -> smoke autenticado de criação/edição/publicação sem mutar versões oficiais indevidamente -> diagnosticar e regularizar oito slots com aprovação escolar -> CI PG17 com RLS e concorrência dos escritores -> aplicação apenas da migration validada, verificação do ledger e contagens.
- Importação XLSX não faz parte do escopo. Sem alteração de produção nesta auditoria.
