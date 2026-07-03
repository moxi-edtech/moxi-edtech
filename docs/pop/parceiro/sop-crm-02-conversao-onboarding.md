# SOP-CRM-02 - Conversão de Lead Ganho em Pedido de Onboarding

Versao: 1.3.0
Data: 2026-07-01
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_membro (Operador do Parceiro)

## 1. Objetivo

Converter um lead qualificado do CRM comercial em um pedido oficial de onboarding (`onboarding_request`), gerar o `tracking_token` e iniciar corretamente o workflow operacional de 7 etapas.

## 2. Quando usar

- Quando o diretor do colégio aceitar a proposta comercial da KLASSE.
- Imediatamente após a escola autorizar o início do processo de configuração.

## 3. Responsáveis

- **Executor:** Operador do parceiro responsável pela negociação comercial.
- **Aprovador de infraestrutura:** Super Admin da KLASSE (para liberação e provisionamento final após conclusão das etapas).

## 4. Pré-condições

- Lead já cadastrado no CRM comercial e com dados mínimos preenchidos.
- Confirmação formal da escola quanto ao plano comercial desejado, valores de ativação/instalação e **modelo pedagógico (preset de currículo)**.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx` e `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/convert/route.ts`.

- A conversao real aparece no detalhe do lead, no bloco `Ativação da Escola`.
- O detalhe do lead possui o bloco `Proposta Comercial`, onde o operador confirma termos e status comercial.
- O botao real e `Criar pedido de onboarding`; durante envio, mostra `A criar onboarding...`.
- A conversao usa `POST /api/influencers/{codigo}/crm/leads/{leadId}/convert` e a RPC `convert_influencer_crm_lead_to_onboarding`.
- Depois de convertido, a UI mostra `Lead convertido em pedido de onboarding`, token e link `Abrir portal de onboarding`.
- A conversao nao provisiona a escola e nao conclui setup escolar.

## 5. Passo a passo (execução)

1. **Localizar o Lead:** Acesse o painel do parceiro, encontre o colégio desejado no pipeline ou na listagem de leads.
2. **Alterar Etapa do Lead:** Mova o cartão do lead para a etapa **Ganho** quando aplicavel, ou abra o detalhe do lead.
3. **Preencher Proposta Comercial:** No bloco `Proposta Comercial`, confirme ou ajuste:
   - Plano contratado.
   - Modelo Curricular (Preset) da escola (ex: Ensino Primário, Técnico de Informática, etc.).
   - Número estimado de alunos.
   - Período de trial negociado (máx 30 dias).
   - Taxa de ativação acordada.
   - Mensalidade acordada.
   - Status comercial (`aceite_comercial` ou `aguardando_contrato_klasse`).
4. **Acionar Conversão:** No bloco `Ativação da Escola`, clique em **Criar pedido de onboarding**.
   - O sistema executará a RPC interna `convert_influencer_crm_lead_to_onboarding`.
   - Será gerada uma solicitação oficial na tabela `onboarding_requests`.
   - O sistema criará automaticamente as **7 etapas de onboarding** correspondentes na tabela `onboarding_steps`.
   - Será gerado um token curto e seguro de rastreamento (ex.: `AELS-91PA-TRM8`).
   - O pedido nasce com status `pendente`.
5. **Entregar Acesso à Escola:**
   - Abra ou copie o link **Abrir portal de onboarding** gerado (ex.: `/onboarding/acompanhar/AELS-91PA-TRM8`).
   - Envie este link oficial para o Diretor Geral ou Secretário da escola via e-mail ou WhatsApp corporativo, orientando-os a acompanhar a linha do tempo do onboarding e a realizar os uploads dos documentos solicitados.

## 5.1 Fluxo real após a conversão

1. `diagnostico`
2. `docs_legais`
3. `planilhas`
4. `validacao`
5. `config`
6. `treinamento`
7. `live`

Regras operacionais:

- Upload move etapa documental para `em_progresso`.
- Triagem do parceiro nao conclui etapa.
- Aprovacao final da KLASSE conclui etapa.
- Provisionamento so acontece com as 7 etapas em `concluido`.

## 6. Resultado esperado

- Status do lead no CRM atualizado para `'ganho'`.
- Registro de onboarding criado com status `'pendente'`.
- Linha do tempo de 7 etapas ativa e visível tanto para a escola quanto para o parceiro.
- Logs de auditoria gerados registrando proposta comercial, conversão e operador responsável.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Lead marcado como "Perdido" não pode ser convertido | Regra do banco impede converter leads no estado de perda. | Reabrir o lead no CRM, movendo-o para a etapa de negociação ou proposta antes de convertê-lo. | Caso o lead não permita alteração de estado no painel. |
| Botao `Criar pedido de onboarding` desabilitado com aviso amarelo | Falta etapa `ganho`, aceite comercial ou algum termo financeiro obrigatório. | Revisar o bloco `Proposta Comercial`, validar trial/taxa e definir status `aceite_comercial` ou `aguardando_contrato_klasse`. | Se todos os campos estiverem corretos e o bloqueio persistir. |
| Token de rastreamento não aparece | Falha temporária na geração do registro pela RPC. | Atualizar a página. Se o erro persistir, verificar na listagem de Onboarding se o registro já não foi criado. | Se a conversão falhar no banco (erro técnico na chamada). |
| Escola espera provisionamento imediato | Confusao entre conversao comercial e provisionamento real. | Explicar que a conversao apenas cria o pedido de onboarding. | Se todas as etapas estiverem concluídas e o provisionamento continuar bloqueado. |

## 8. Evidências obrigatórias

- Presença da escola na aba **Escolas em Onboarding** com o respectivo token ativo.
- Comprovante de envio do link de rastreamento ao cliente (ex. print da mensagem de WhatsApp ou e-mail enviado).

## 9. KPI operacional do procedimento

- **Tempo de geração do onboarding:** < 1 minuto após fecho comercial.
- **SLA de envio do link de rastreamento:** Envio em até 4 horas úteis após a conversão.

## 10. Riscos e controles

- **Risco:** Iniciar o onboarding sem termos financeiros bem definidos.
  - *Controle:* O sistema exige etapa `ganho`, `trial_days` valido, `taxa_ativacao > 0` e status comercial pronto antes de permitir a conversão.
