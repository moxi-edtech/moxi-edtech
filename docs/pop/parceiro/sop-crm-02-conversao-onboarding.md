# SOP-CRM-02 - Conversão de Lead Ganho e Acompanhamento de Onboarding

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_membro (Operador do Parceiro)

## 1. Objetivo

Converter um lead qualificado do CRM comercial (etapa de proposta aceita) em uma solicitação de ativação oficial (Onboarding Request), gerando o código único de rastreamento (`tracking_token`) e inicializando o pipeline de 7 fases de implantação.

## 2. Quando usar

- Quando o diretor do colégio aceitar a proposta comercial da KLASSE.
- Imediatamente após a escola autorizar o início do processo de configuração.

## 3. Responsáveis

- **Executor:** Operador do parceiro responsável pela negociação comercial.
- **Aprovador de infraestrutura:** Super Admin da KLASSE (para liberação e provisionamento final após conclusão das etapas).

## 4. Pré-condições

- Lead já cadastrado no CRM comercial e com dados mínimos preenchidos.
- Confirmação formal da escola quanto ao plano comercial desejado e valores de ativação/instalação.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx` e `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/convert/route.ts`.

- A conversao real aparece no detalhe do lead, no bloco `Ativação da Escola`.
- O botao real e `Iniciar ativação`; durante envio, mostra `A criar ativação...`.
- A conversao usa `POST /api/influencers/{codigo}/crm/leads/{leadId}/convert` e a RPC `convert_influencer_crm_lead_to_onboarding`.
- Depois de convertido, a UI mostra `Lead convertido para onboarding`, token e link `Abrir portal de ativação`.

## 5. Passo a passo (execução)

1. **Localizar o Lead:** Acesse o painel do parceiro, encontre o colégio desejado no pipeline ou na listagem de leads.
2. **Alterar Etapa do Lead:** Mova o cartão do lead para a etapa **Ganho** quando aplicavel, ou abra o detalhe do lead.
3. **Confirmar Dados Financeiros de Conversão:** A tela exibirá um resumo das configurações acordadas:
   - Plano contratado (Essencial / Profissional / Premium).
   - Período de trial negociado (máx 30 dias).
   - Taxa de ativação acordada (ex. 50.000 Kz).
   *Caso seja necessário reajustar alguma dessas variáveis, edite antes de confirmar a conversão.*
4. **Acionar Conversão:** No bloco `Ativação da Escola`, clique em **Iniciar ativação**.
   - O sistema executará a RPC interna `convert_influencer_crm_lead_to_onboarding`.
   - Será gerada uma solicitação oficial na tabela `onboarding_requests`.
   - O sistema criará automaticamente as **7 etapas de onboarding** correspondentes na tabela `onboarding_steps`.
   - Será gerado um token curto e seguro de rastreamento (ex.: `AELS-91PA-TRM8`).
5. **Entregar Acesso à Escola:**
   - Abra ou copie o link **Abrir portal de ativação** gerado (ex.: `/onboarding/acompanhar/AELS-91PA-TRM8`).
   - Envie este link oficial para o Diretor Geral ou Secretário da escola via e-mail ou WhatsApp corporativo, orientando-os a acompanhar a linha do tempo da ativação e a realizar os uploads dos documentos solicitados.

## 6. Resultado esperado

- Status do lead no CRM atualizado para `'ganho'`.
- Registro de onboarding criado com status `'pendente'`.
- Linha do tempo de 7 etapas ativa e visível tanto para a escola quanto para o parceiro.
- Logs de auditoria gerados registrando a conversão e o operador responsável.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Lead marcado como "Perdido" não pode ser convertido | Regra do banco impede converter leads no estado de perda. | Reabrir o lead no CRM, movendo-o para a etapa de negociação ou proposta antes de convertê-lo. | Caso o lead não permita alteração de estado no painel. |
| Token de rastreamento não aparece | Falha temporária na geração do registro pela RPC. | Atualizar a página. Se o erro persistir, verificar na listagem de Onboarding se o registro já não foi criado. | Se a conversão falhar no banco (erro técnico na chamada). |

## 8. Evidências obrigatórias

- Presença da escola na aba **Escolas em Onboarding** com o respectivo token ativo.
- Comprovante de envio do link de rastreamento ao cliente (ex. print da mensagem de WhatsApp ou e-mail enviado).

## 9. KPI operacional do procedimento

- **Tempo de geração do onboarding:** < 1 minuto após fecho comercial.
- **SLA de envio do link de rastreamento:** Envio em até 4 horas úteis após a conversão.

## 10. Riscos e controles

- **Risco:** Iniciar o onboarding sem termos financeiros bem definidos.
  - *Controle:* O sistema exige o preenchimento de `plano_estimado`, `trial_days` e `taxa_ativacao` no JSONB `financeiro` da solicitação antes de permitir a conversão, travando valores incorretos.
