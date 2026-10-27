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
| Níveis de ensino | `niveis_ensino` | Pré-escolar, Primário, I Ciclo, PUNIV, Técnico; códigos desconhecidos bloqueiam impressão |
| Modelo curricular | `preset_curricular` do formulário | Exibir o preset escolhido; se não houver, marcar configuração manual; sujeito à validação no onboarding |
| Contactos operacionais | `contato_secretaria`, `contato_financeiro`, `contato_pedagogico` (nome, e-mail, telefone) | Mostrar os três pontos focais na implantação; campos vazios como «A confirmar», não obrigatórios para impressão |
| Estado comercial | `commercial_status` | **Não imprimir**: estado de workflow interno, não declaração de aceite ou assinatura |
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

A pré-visualização passa os dados negociados, a seleção curricular e os três contactos por **fragmento URL (`#`)**, que não é transmitido ao servidor no pedido HTTP nem no cabeçalho Referer. Os antigos links com parâmetros em query string continuam a ser lidos por compatibilidade, mas o CRM deixa de os gerar. **O fragmento ainda é visível no histórico e na barra de endereços**, pelo que não substitui controlos de acesso, autorização, armazenamento seguro ou emissão oficial. A solução auditável deverá gerar por ID persistido com autenticação CRM, snapshot imutável versionado e PDF no servidor. Uma prévia não comprova autorização, assinatura ou negociação aprovada.

## Verificação

Executar `node --test --import tsx tests/unit/crm-commercial-proposal.spec.ts` a partir de `apps/web`, `pnpm --filter web typecheck`, lint dos ficheiros alterados e ensaio de impressão A4 nas versões desktop e telemóvel. Casos obrigatórios: taxa zero, ausência de mensalidade, plano excedido, proposta premium negociada, trial 0/30/31, pré-escolar e os restantes níveis, presets curriculares, três contactos (preenchidos e vazios), códigos desconhecidos e campos longos. O estado comercial continua no CRM, fora do papel.

A proposta fonte é preservada intacta no Google Docs.
