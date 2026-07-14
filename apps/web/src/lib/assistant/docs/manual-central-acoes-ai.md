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

## 3. Integração com Actions v2

No padrão KLASSE IA Actions v2, o assistente pode responder com texto e botões de ação.

A Central de Ações IA continua sendo obrigatória para qualquer ação de risco alto:

- plano de cobrança;
- rascunho WhatsApp;
- comunicado público;
- recomendação operacional que possa gerar impacto financeiro, acadêmico ou reputacional.

Fluxo recomendado:

1. O assistente identifica a intenção.
2. O backend consulta uma ferramenta autorizada ou prepara um rascunho.
3. A resposta mostra uma action como `Salvar na Central de Ações IA`.
4. O usuário revisa a action salva.
5. Um usuário autorizado aprova, rejeita ou cancela.

Actions de baixo risco, como abrir telas ou copiar texto, não precisam ser salvas na Central. Actions de médio risco, como exportar lista ou preparar modal operacional, exigem intenção explícita do usuário, mas não aprovação formal se não houver envio externo nem escrita crítica.
