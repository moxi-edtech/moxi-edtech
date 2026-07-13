# SOP-CRM-04 - Gestão de Comissões, Ledger e Solicitação de Payout

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_admin (Emanuel Caetano / Administrador)

## 1. Objetivo

Acompanhar o extrato de comissões geradas (ativas e recorrentes), validar valores pendentes/aprovados/pagos e solicitar payout pelo portal com fatura/recibo obrigatório.

## 2. Quando usar

- Ao final de cada mês, para fechamento e conciliação financeira do escritório.
- Até o dia 5 de cada mês, para validação de faturamento e solicitação do pedido de repasse.

## 3. Responsáveis

- **Responsavel pelo acompanhamento:** Administrador do parceiro (`afiliado_admin`).
- **Aprovador Financeiro:** Setor financeiro da KLASSE (David Chocaliye / Moxi).
- **Escalonamento:** David Chocaliye (caso haja divergência no fechamento de valores arrecadados das escolas).

## 4. Pré-condições

- Login no portal com perfil administrativo do escritório (`afiliado_admin`).
- Emissão de fatura/recibo do escritório (CLARUS AN) correspondente ao valor das comissões consolidadas.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx`, `apps/web/src/app/api/influencers/[codigo]/commissions/route.ts`, `apps/web/src/app/api/influencers/[codigo]/commissions/payouts/route.ts` e `apps/web/src/app/api/super-admin/commissions/payouts/route.ts`.

- A area real chama `Sua Comissão` e mostra `Total em Ledger` ou `Total Estimado`.
- O portal mostra totais `Pendente`, `Aprovado`, `Pago`, lista `Últimas comissões`, `Simulador de Ganhos`, saldo disponível para payout e histórico recente de pedidos.
- A API do parceiro para comissoes usa `GET /api/influencers/{codigo}/commissions`.
- A solicitação de payout usa `POST /api/influencers/{codigo}/commissions/payouts`, exige fatura/recibo e cria pedido para aprovação do Super Admin.
- O Super Admin aprova, rejeita, cancela ou marca payout como pago em `/api/super-admin/commissions/payouts`.

## 5. Passo a passo (execução)

1. **Acessar a Área Financeira:** No portal do parceiro, navegue até a aba **Comissões & Ganhos** (ou **Painel Financeiro**).
2. **Visualizar o Extrato (Ledger):** O painel exibirá o extrato contendo dois tipos de comissões:
   - **Comissões de Ativação (`ativacao`):** Valor fixo de 100% da taxa de instalação acordada (ex. 50.000 Kz). Gerada automaticamente após o provisionamento da escola em produção.
   - **Comissões Recorrentes (`recorrente`):** Repasse de 25% sobre o valor líquido das mensalidades do plano contratado pela escola.
3. **Validar as Regras de Faturamento (Regime de Caixa):**
   - Lembre-se: as comissões recorrentes só mudam do estado `'pending'` (pendente) para `'approved'` (aprovada) após a escola efetuar o pagamento da fatura SaaS e a KLASSE realizar a compensação bancária (Regime de Caixa).
   - Se uma escola estiver inadimplente, a respectiva comissão recorrente permanecerá retida até a quitação do débito pelo cliente.
4. **Fechamento do Mês (Período de Apuração):**
   - No último dia útil do mês, verifique o montante consolidado em **Disponível para Resgate**. Este valor soma todas as comissões que passaram para o status `'approved'` durante o mês vigente.
5. **Solicitar payout no portal:**
   - Recolha o valor `Aprovado` exibido no portal.
   - Emita a fatura/recibo oficial do escritório.
   - Use a ação de payout no portal, anexe a fatura/recibo e submeta o pedido.
6. **Acompanhamento do Repasse:**
- A equipe financeira da KLASSE analisará a solicitação e o comprovante cadastrado.
- O pagamento será realizado por transferência bancária até o **dia 10 do mês subsequente**. Após a transferência, o status da comissão no portal passará para `'paid'` (paga).

## 6. Resultado esperado

- Valores de comissao conferidos no portal.
- Pedido de repasse submetido no portal com fatura/recibo anexado.
- Status `paid` acompanhado quando o financeiro liquidar a comissao.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Comissão recorrente de escola ativa não aparece no extrato | A escola não efetuou o pagamento da mensalidade SaaS ou o pagamento está pendente de conciliação bancária na KLASSE. | Solicitar à secretaria da escola o comprovante de pagamento da assinatura KLASSE e contatar o suporte financeiro. | Caso o pagamento da escola tenha sido compensado há mais de 48h e não conste no painel. |
| Payout nao aceita submissao | Nao ha valor aprovado disponivel, a fatura/recibo nao foi anexada ou ja existe payout ativo para as mesmas comissoes. | Confirmar saldo disponivel, anexar documento valido e verificar historico recente de pedidos. | Se houver saldo aprovado sem payout ativo e a submissao continuar falhando. |

## 8. Evidências obrigatórias

- Print dos totais `Pendente`, `Aprovado` e `Pago`.
- Fatura/recibo anexado ao pedido de payout.
- Comprovante de transferência bancária emitido pelo banco parceiro da KLASSE (anexado pelo Super Admin ao liquidar a solicitação).

## 9. KPI operacional do procedimento

- **SLA de Apuração:** Consolidação de saldo concluída até o dia 5 de cada mês.
- **SLA de Repasse:** Payout transferido para a conta bancária do parceiro até o dia 10.

## 10. Riscos e controles

- **Risco:** Tratar valor pendente como disponivel.
  - *Controle:* Usar apenas o valor `Aprovado` e disponivel para payout como base da solicitação no portal.
