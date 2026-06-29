# SOP-CRM-04 - Gestão de Comissões, Ledger e Solicitação de Payout

Versao: 1.1.0
Data: 2026-06-29
Modulo: CRM / Portal do Parceiro
Perfil principal: afiliado_admin (Emanuel Caetano / Administrador)

## 1. Objetivo

Acompanhar o extrato de comissões geradas (ativas e recorrentes), validar valores pendentes/aprovados/pagos e preparar a conciliação financeira mensal fora do portal quando necessario.

## 2. Quando usar

- Ao final de cada mês, para fechamento e conciliação financeira do escritório.
- Até o dia 5 de cada mês, para validação de faturamento e preparação manual do pedido de repasse.

## 3. Responsáveis

- **Responsavel pelo acompanhamento:** Administrador do parceiro (`afiliado_admin`).
- **Aprovador Financeiro:** Setor financeiro da KLASSE (David Chocaliye / Moxi).
- **Escalonamento:** David Chocaliye (caso haja divergência no fechamento de valores arrecadados das escolas).

## 4. Pré-condições

- Login no portal com perfil administrativo do escritório (`afiliado_admin`).
- Emissão de fatura/recibo do escritório (CLARUS AN) correspondente ao valor das comissões consolidadas.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx` e `apps/web/src/app/api/influencers/[codigo]/commissions/route.ts`.

- A area real chama `Sua Comissão` e mostra `Total em Ledger` ou `Total Estimado`.
- O portal mostra totais `Pendente`, `Aprovado`, `Pago`, lista `Últimas comissões` e `Simulador de Ganhos`.
- A API do parceiro para comissoes e somente leitura: `GET /api/influencers/{codigo}/commissions`.
- Nao existe rota ou botao de `Solicitar Resgate / Payout` no namespace `api/influencers` no codigo atual.
- Solicitar payout pelo portal do parceiro e `NAO OPERACIONAL NO CODIGO ACTUAL`.

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
5. **Preparar pedido manual de repasse:**
   - Recolha o valor `Aprovado` exibido no portal.
   - Emita a fatura/recibo oficial fora do portal.
   - Envie a solicitação ao financeiro da KLASSE pelo canal operacional combinado.
6. **Acompanhamento do Repasse:**
- A equipe financeira da KLASSE analisará a solicitação e o comprovante cadastrado.
- O pagamento será realizado por transferência bancária até o **dia 10 do mês subsequente**. Após a transferência, o status da comissão no portal passará para `'paid'` (paga).

NAO OPERACIONAL NO CODIGO ACTUAL:
- Solicitar payout dentro do portal do parceiro.
- Fazer upload de fatura/recibo dentro do portal do parceiro.
- Gerar protocolo de payout pelo portal do parceiro.

## 6. Resultado esperado

- Valores de comissao conferidos no portal.
- Pedido manual de repasse preparado com base no valor aprovado.
- Status `paid` acompanhado quando o financeiro liquidar a comissao.

## 7. Erros comuns e correção

| Erro observado | Causa provável | Correção imediata | Escalar quando |
|---|---|---|---|
| Comissão recorrente de escola ativa não aparece no extrato | A escola não efetuou o pagamento da mensalidade SaaS ou o pagamento está pendente de conciliação bancária na KLASSE. | Solicitar à secretaria da escola o comprovante de pagamento da assinatura KLASSE e contatar o suporte financeiro. | Caso o pagamento da escola tenha sido compensado há mais de 48h e não conste no painel. |
| Nao aparece botao de payout | Funcao nao existe no portal do parceiro. | Solicitar repasse por canal financeiro combinado e anexar evidencias fora do portal. | Se a funcionalidade precisar ser implementada. |

## 8. Evidências obrigatórias

- Print dos totais `Pendente`, `Aprovado` e `Pago`.
- Fatura/recibo emitido fora do portal.
- Comprovante de transferência bancária emitido pelo banco parceiro da KLASSE (anexado pelo Super Admin ao liquidar a solicitação).

## 9. KPI operacional do procedimento

- **SLA de Apuração:** Consolidação de saldo concluída até o dia 5 de cada mês.
- **SLA de Repasse:** Payout transferido para a conta bancária do parceiro até o dia 10.

## 10. Riscos e controles

- **Risco:** Tratar valor pendente como disponivel.
  - *Controle:* Usar apenas o valor `Aprovado` como base para solicitação manual de repasse.
