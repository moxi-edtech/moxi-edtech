# Aprovação necessária — correção de destinos Curtume com dívida antiga

run_id: CURTUME-DESTINOS-DIVIDA-20260823
timestamp: 2026-08-23

## Acção proposta

Aplicar a migration `20270823230000_curtume_hold_active_destinations_with_legacy_debt.sql`.
Ela coloca em reserva (`pendente`, inativa) exclusivamente as matrículas 2026 do Curtume que já estão ativas mas possuem dívida vencida ligada à matrícula de origem de 2025.

## Impacto confirmado antes da aplicação

- destinos 2026 ativos com saldo vencido de origem: **2**;
- saldo vencido total: **27.000 Kz**;
- nenhuma cobrança, pagamento ou título financeiro será alterado.

## Risco

Os dois alunos deixam de constar como ativos em 2026 até a dívida ser regularizada e a secretaria concluir o atendimento no Balcão.

## Como aprovar

Enviar: `APPROVE: CURTUME-DESTINOS-DIVIDA-20260823`

## Como rejeitar

Enviar: `REJECT: CURTUME-DESTINOS-DIVIDA-20260823 [motivo]`
