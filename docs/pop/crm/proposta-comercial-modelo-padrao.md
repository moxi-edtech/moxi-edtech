# CRM KLASSE — Modelo padrão de proposta comercial

Referência editorial e contratual: [Proposta Comercial — Makuntima Zinga (26/09/2026)](https://docs.google.com/document/d/1Y0na04zmZgJcm4AuqzqER9KSGvZzgPxabxD7xxQL2I4/edit).

## Decisão

A proposta do Makuntima Zinga é o **modelo de conteúdo e estrutura**, não a negociação padrão. A pré-visualização/impressão do CRM em `/crm/proposta/preview` adota as sete secções: objetivo, escopo, condições comerciais, pagamento, implantação inicial, premissas, aceite; conclui com a identificação da prestadora. Impressão via diálogo nativo do browser para A4/PDF.

**Não copiar como padrão:** nome Makuntima Zinga; 401–800 alunos; R$? Não: a moeda é Kz; taxa de ativação Kz 50.000, mensalidade Kz 140.000, data 24/09/2026 e plano Profissional são específicos daquela negociação. O CRM deve preencher os campos a partir do lead e das condições editáveis. Nenhum valor zero é interpretado como mensalidade válida; taxa 0 é isenção explícita.

## Mapeamento do CRM

| Campo | Origem | Regra de impressão |
| --- | --- | --- |
| Escola | `nome_escola` | Obrigatório |
| Responsável | `nome_contacto` | Quando ausente, «A confirmar na reunião» |
| Alunos | `alunos_estimados` (formulário) | Obrigatório, no limite do plano |
| Plano | `plano_estimado` (formulário) | Essencial / Profissional / Premium |
| Preço e taxa | `mensalidade_kz` e `taxa_ativacao` | Valores negociados; pagamento inicial = soma |
| Trial | `trial_days` | 0–30; período e efeito na cobrança dependem do Termo de Adesão |
| Níveis de ensino | `niveis_ensino` | Apresentar só níveis reconhecidos |
| Data | Navegador na abertura | Validade 15 dias corridos |
| Prestadora / contas | Dados oficiais no documento de referência | Estáticos; revisão obrigatória se alterarem |

Capacidades do plano são declaradas em `apps/web/src/lib/crm/commercial-proposal.ts`, baseadas na migração `20260306090000_plan_limits_contract.sql` e em `apps/landing/app/data/landing.ts`. Uma alteração do catálogo de planos deverá atualizar estas definições. O preço efetivo, porém, **nunca** é inferido do plano.

## Contratos e limites

- A proposta mensal representa pré-pagamento da primeira mensalidade + ativação. Alternativa anual e descontos **não** são calculados automaticamente no CRM, que atualmente não possui campo de ciclo negociado.
- Portais académicos e módulos principais não são prometidos como exclusivos de tiers superiores.
- Os tempos de SLA numéricos da antiga prévia foram removidos; prevalece o SLA formal aplicável, evitando falsas garantias.
- Antes da impressão, exigir escola, plano, alunos, taxa, mensalidade e trial válidos. Não permitir um plano inferior à capacidade estimada.
- O clique em «Pré-visualizar proposta» no detalhe do lead utiliza os valores **atuais do formulário**, mesmo se ainda não foram gravados. O operador deve gravar os termos para preservar o acordo no CRM.
- O botão abre uma pré-visualização, não um documento assinado nem uma fatura fiscal; aceite exige Termo de Adesão e confirmação de pagamento.

## Segurança e dívida técnica

A rota prévia continua a receber escola, contacto e condições comerciais na query string — comportamento **pré-existente**. Eliminámos da URL os dados pessoais dos responsáveis de secretaria, financeiro e pedagogia que já não entram no documento. A solução final para emissão/auditoria deverá usar ID persistido, autenticação CRM, snapshot imutável versionado e endpoint de geração de PDF controlado em servidor; **não** considerar uma URL de preview como prova de autorização, assinatura ou negociação aprovada. Evitar expor estas URLs em analytics ou logs com query string.

## Verificação

Executar `node --test --import tsx tests/unit/crm-commercial-proposal.spec.ts` a partir de `apps/web`, `pnpm --filter web typecheck`, lint dos ficheiros alterados e ensaio de impressão A4 nas versões desktop e telemóvel. Casos obrigatórios: taxa zero, ausência de mensalidade, plano excedido, proposta premium negociada, trial 0/30/31 e campos longos.

A proposta fonte é preservada intacta no Google Docs.
