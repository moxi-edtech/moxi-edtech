# Manual Curto da Central de Ações IA

A Central de Ações IA é o local centralizado onde são guardados os rascunhos de comunicados, planos de cobrança e resumos executivos sugeridos pela IA.

## 1. Funcionamento Geral
- Acessível em **Administração > Central de Ações IA** (rota: `/escola/[schoolId]/admin/ai/actions`).
- Sempre que o assistente do KLASSE gera um texto estruturado, um plano financeiro ou comunicado, ele oferece a opção "Salvar na Central".
- Ao salvar, uma entrada com o estado "draft" é criada na tabela `ai_actions`.

## 2. Auditoria e Risco
- Cada ação gerada por IA possui um nível de risco associado (`low`, `medium`, `high`).
- Ações financeiras ou com impacto em dados externos possuem risco `high` e exigem confirmação visual do usuário administrativo.
- O histórico de geração de rascunhos registra o ID do usuário que solicitou a criação para fins de auditoria no sistema.
- A IA nunca executa comandos destrutivos no banco de dados nem publica mensagens públicas sem aprovação na Central de Ações.
