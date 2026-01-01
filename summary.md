## Resumo Atual

- Notificações direcionadas: rascunhos gerados na importação avisam admin/pedagógico; importações em turmas ativas e ativações de turma pingam o financeiro (tabela `notifications`, `target_role`).
- Contexto financeiro em migração/aprovação: wizard de importação captura “ignorar matrícula” e “mês inicial”, aplica isenção de matrícula e corta mensalidades retroativas ao importar em turmas ativas; a aprovação de turmas rascunho com alunos repete as mesmas regras para evitar cobranças indevidas.
- TurmaForm (rascunhos) exibe bloco “Definição Financeira”, hidrata metadata de importação e envia `migracao_financeira` no submit; o backend aplica abatimento e isenção quando ativa.
- Dashboard Financeiro exibe alertas pendentes; aprovações/importações ativas geram avisos para o tesoureiro auditar preços/lançamentos, enquanto rascunhos notificam apenas quem pode aprovar.
- Liberação de acesso de alunos: UI `/secretaria/acesso-alunos` lista pendentes, usa `/liberar-acesso` (cria usuário/profile se faltar, gera código, enfileira notificação) e `/ativar-acesso` (código + BI). Depende de outbox + worker com Twilio/Resend (WhatsApp/SMS/email).
