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
- **Aprovador de infraestrutura:** Super Admin da KLASSE (para provisionamento final após conclusão das etapas).

## 4. Pré-condições

- Lead já cadastrado no CRM comercial e com dados mínimos preenchidos.
- Lead movido para a etapa `ganho`.
- Proposta comercial registada com plano, alunos, trial, taxa de ativação e mensalidade.
- Status comercial marcado como `aceite_comercial` ou `aguardando_contrato_klasse`.
- Confirmação formal da escola quanto ao plano comercial desejado e valores de ativação/instalação.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx`, `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/convert/route.ts`, `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/commercial/route.ts` e `apps/web/src/app/api/influencers/[codigo]/crm/leads/[leadId]/proposal/route.ts`.

- A conversao real aparece no detalhe do lead, no bloco `Ativação da Escola`.
- O detalhe do lead agora possui o bloco `Proposta Comercial`, onde o operador edita termos, mensalidade e status comercial.
- O operador pode anexar proposta/contrato preliminar e abrir o documento novamente no mesmo drawer.
- O botao real e `Criar pedido de onboarding`; durante envio, mostra `A criar onboarding...`.
- A conversao usa `POST /api/influencers/{codigo}/crm/leads/{leadId}/convert` e a RPC `convert_influencer_crm_lead_to_onboarding`.
- O salvamento da proposta usa `PATCH /api/influencers/{codigo}/crm/leads/{leadId}/commercial`.
- O upload do documento comercial usa `POST /api/influencers/{codigo}/crm/leads/{leadId}/proposal`.
- Depois de convertido, a UI mostra `Lead convertido em pedido de onboarding`, token e link `Abrir portal de onboarding`.
- A conversao nao provisiona a escola.
- A conversao nao conclui setup escolar.
- O follow-up comercial isolado nao move etapa de onboarding.

## 5. Passo a passo (execução)

1. **Localizar o Lead:** Acesse o painel do parceiro, encontre o colégio desejado no pipeline ou na listagem de leads.
2. **Alterar Etapa do Lead:** Mova o cartão do lead para a etapa **Ganho** quando aplicavel, ou abra o detalhe do lead.
3. **Preencher Proposta Comercial:** No bloco `Proposta Comercial`, confirme ou ajuste:
   - Plano contratado (Essencial / Profissional / Premium).
   - Número estimado de alunos.
   - Período de trial negociado (máx 30 dias).
   - Taxa de ativação acordada.
   - Mensalidade acordada.
   - Status comercial (`rascunho`, `proposta_enviada`, `aceite_comercial` ou `aguardando_contrato_klasse`).
4. **Anexar Documento Comercial:** Se houver proposta em PDF, imagem ou contrato preliminar, use a ação `Anexar proposta` para guardar o ficheiro no lead.
5. **Registrar Aceite Comercial:** Quando a escola aprovar a proposta, atualize o status comercial para `aceite_comercial` ou `aguardando_contrato_klasse`, conforme o momento do contrato.
6. **Acionar Conversão:** No bloco `Ativação da Escola`, clique em **Criar pedido de onboarding**.
   - O sistema executará a RPC interna `convert_influencer_crm_lead_to_onboarding`.
   - Será gerada uma solicitação oficial na tabela `onboarding_requests`.
   - O sistema criará automaticamente as **7 etapas de onboarding** correspondentes na tabela `onboarding_steps`.
   - Será gerado um token curto e seguro de rastreamento (ex.: `AELS-91PA-TRM8`).
   - O status inicial do pedido será `pendente`.
   - A escola ainda nao estara provisionada neste momento.
7. **Entregar Acesso à Escola:**
   - Abra ou copie o link **Abrir portal de onboarding** gerado (ex.: `/onboarding/acompanhar/AELS-91PA-TRM8`).
   - Envie este link oficial para o Diretor Geral ou Secretário da escola via e-mail ou WhatsApp corporativo, orientando-os a acompanhar a linha do tempo do onboarding e a realizar os uploads dos documentos solicitados.

## 5.1 Fluxo real após a conversão

Depois da conversao, o fluxo operacional correto e:

1. `diagnostico` - etapa derivada do arranque do pedido
2. `docs_legais` - escola envia documentos legais
3. `planilhas` - escola envia planilhas operacionais
4. `validacao` - KLASSE valida tecnicamente os insumos
5. `config` - parceiro acompanha configuracao operacional
6. `treinamento` - parceiro acompanha treinamento
7. `live` - KLASSE fecha a etapa final antes do provisionamento

Regras operacionais importantes:

- Upload da escola move `docs_legais` ou `planilhas` para `em_progresso`.
- Triagem do parceiro classifica o upload, mas nao conclui a etapa.
- Aprovacao final da KLASSE e que conclui a etapa correspondente.
- O provisionamento so acontece quando todas as 7 etapas estiverem `concluido`.

## 6. Resultado esperado

- Status do lead no CRM atualizado para `'ganho'`.
- Pedido de onboarding criado com status `'pendente'`.
- Linha do tempo de 7 etapas ativa e visível tanto para a escola quanto para o parceiro.
- Logs de auditoria gerados registrando proposta comercial, upload de documento, conversão e operador responsável.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Lead marcado como "Perdido" não pode ser convertido | Regra do banco impede converter leads no estado de perda. | Reabrir o lead no CRM, movendo-o para a etapa de negociação ou proposta antes de convertê-lo. | Caso o lead não permita alteração de estado no painel. |
| Botao `Criar pedido de onboarding` desabilitado com aviso amarelo | Falta etapa `ganho`, aceite comercial ou algum termo financeiro obrigatório. | Revisar o bloco `Proposta Comercial`, preencher mensalidade, validar trial/taxa e definir status `aceite_comercial` ou `aguardando_contrato_klasse`. | Se todos os campos estiverem corretos e o bloqueio persistir. |
| Upload da proposta falha | Formato ou tamanho do arquivo nao permitido. | Reenviar em PDF, PNG, JPG ou WEBP com até 10 MB. | Se o arquivo respeitar o limite e continuar falhando. |
| Token de rastreamento não aparece | Falha temporária na geração do registro pela RPC. | Atualizar a página. Se o erro persistir, verificar na listagem de Onboarding se o registro já não foi criado. | Se a conversão falhar no banco (erro técnico na chamada). |
| Escola ou parceiro esperam provisionamento imediato | Confusao entre conversao comercial e provisionamento real. | Explicar que a conversao apenas cria o pedido de onboarding; o provisionamento depende da conclusao das 7 etapas. | Se a escola ja tiver cumprido todas as etapas e o provisionamento seguir bloqueado. |

## 8. Evidências obrigatórias

- Presença da escola na aba **Escolas em Onboarding** com o respectivo token ativo.
- Comprovante de envio do link de rastreamento ao cliente (ex. print da mensagem de WhatsApp ou e-mail enviado).

## 9. KPI operacional do procedimento

- **Tempo de geração do onboarding:** < 1 minuto após fecho comercial.
- **SLA de envio do link de rastreamento:** Envio em até 4 horas úteis após a conversão.

## 10. Riscos e controles

- **Risco:** Iniciar o onboarding sem termos financeiros bem definidos.
  - *Controle:* O sistema exige etapa `ganho`, `trial_days` valido, `taxa_ativacao > 0` e status comercial pronto (`aceite_comercial` ou `aguardando_contrato_klasse`) antes de permitir a conversão.
