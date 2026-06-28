# Manual Curto do Portal Financeiro

O Portal Financeiro do KLASSE gerencia todas as cobranças de mensalidades (propinas), recebimentos, controle de fluxo de caixa e o Radar de Inadimplência.

## 1. Radar de Inadimplência
- Acessível em **Financeiro > Radar** (rota: `/escola/[schoolId]/financeiro/radar`).
- O Radar lista todos os encarregados de educação com parcelas ou propinas em atraso no ano letivo ativo.
- Permite filtrar devedores por turmas, dias de atraso ou valores.
- O assistente de IA pode analisar o Radar para ajudar a estruturar e sugerir prioridades de cobrança, mas o usuário deve validar as ações antes de enviá-las.

## 2. Registro de Pagamentos
- Acessível em **Financeiro > Pagamentos** (rota: `/escola/[schoolId]/financeiro/pagamentos`).
- Selecione o aluno, identifique as parcelas em aberto, selecione a forma de pagamento (Dinheiro, TPA, Transferência Bancária, KWIK) e lance o valor.
- O sistema bloqueia lançamentos de pagamentos de mensalidades futuras se houver mensalidades anteriores em aberto, garantindo a ordem cronológica.
- A emissão de recibos oficiais e notas de crédito/débito é realizada e assinada digitalmente de forma automática.

## 3. Planos de Cobrança e Regras de Negócio
- Não é permitida a exclusão ou alteração de dados financeiros consolidados diretamente por IA.
- A IA pode atuar sugerindo rascunhos de planos de cobrança amigáveis ou urgentes.
- Rascunhos devem ser salvos na Central de Ações IA para posterior revisão e ativação pelo administrador financeiro.
