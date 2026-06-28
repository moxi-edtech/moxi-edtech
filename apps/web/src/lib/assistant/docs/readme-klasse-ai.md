# README do KLASSE AI

Bem-vindo ao KLASSE AI — o assistente de produtividade e suporte integrado do sistema KLASSE.

## 1. Diretrizes de Operação e Segurança
- O KLASSE AI opera como um assistente contextual. Ele analisa a tela atual para sugerir ações relevantes.
- O assistente **nunca** possui autonomia para alterar dados críticos do sistema diretamente. Não é possível, por meio de comandos de texto, alterar notas de alunos, lançar pagamentos reais, reverter transações fiscais ou excluir matrículas.
- Todas as tarefas administrativas críticas geram rascunhos que exigem revisão e aprovação humana explícita.

## 2. Proteção de Dados e PII
- O KLASSE AI foi desenhado seguindo princípios estritos de privacidade.
- Dados de identificação pessoal (PII) sensíveis de alunos, como números de telefone e e-mails pessoais, não são enviados para provedores externos de IA.
- O assistente usa dados agregados e placeholders (`[Nome]`, `[Valor]`) para formular rascunhos de cobrança e avisos.

## 3. Créditos e Limites
- Cada escola possui limites diários e mensais de uso de IA gerenciados via `ai_school_settings`.
- Cada chamada de IA consome um slot do plano, que é registrado na tabela `ai_usage_logs` via RPC `claim_ai_usage_slot`.
- O caminho rápido (Fast Path) de respostas baseadas em registries locais não consome créditos de IA da escola.
