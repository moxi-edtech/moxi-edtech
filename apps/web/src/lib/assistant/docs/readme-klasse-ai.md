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

## 4. Maturidade Atual

O KLASSE AI está pronto para atuar como assistente administrativo guiado, mas ainda não deve ser tratado como agente operacional autônomo.

Capacidades atuais:
- Responder perguntas frequentes por Fast Path local.
- Orientar navegação por rotas oficiais e permissões.
- Usar base de conhecimento documentada para respostas RAG controladas.
- Ler contexto básico da tela atual.
- Gerar rascunhos de comunicados, cobranças e resumos.
- Registrar uso, cotas e falhas em `ai_usage_logs`.
- Salvar rascunhos auditáveis na Central de Ações IA.

Limites atuais:
- O contexto de tela ainda é resumido; nem sempre inclui dados vivos suficientes para decisão operacional.
- O assistente responde mais do que age.
- A busca de conhecimento ainda é baseada em score textual simples, não em índice semântico dedicado.
- A memória operacional por escola e usuário ainda não está formalizada.
- A IA não deve executar pagamentos, notas, exclusões, envios públicos ou alterações críticas.

## 5. Direção Produto — KLASSE IA Actions v2

A próxima evolução é o padrão **Actions v2**: toda resposta operacional pode retornar texto explicativo e ações seguras renderizadas pela interface.

Formato conceitual:

```json
{
  "answer": "Encontrei 12 alunos em atraso nesta turma.",
  "actions": [
    { "kind": "open_screen", "label": "Abrir Radar", "href": "/escola/[id]/financeiro/radar" },
    { "kind": "prepare_draft", "label": "Gerar mensagem de cobrança", "riskLevel": "high", "requiresApproval": true },
    { "kind": "export", "label": "Exportar lista", "riskLevel": "medium", "requiresApproval": false }
  ]
}
```

Regras do Actions v2:
- O modelo nunca recebe acesso direto ao banco.
- O backend resolve escola, perfil, intenção, entidades e permissões.
- Cada ação deve existir num registry fechado, com risco, permissão e modo de execução definidos.
- Ações de escrita, envio externo ou impacto financeiro exigem confirmação ou Central de Ações IA.
- A interface mostra botões claros; a IA não “clica” nem executa silenciosamente.

Documento de implementação: `plano-actions-v2.md`.
