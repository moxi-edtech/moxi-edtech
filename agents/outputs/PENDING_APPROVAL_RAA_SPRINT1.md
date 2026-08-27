# Aprovação necessária — RAA Sprint 1

run_id:  2E7A1C44-RAA-SPRINT1-EXAM-MODEL
timestamp: 2026-08-15

## Acção proposta

Aplicar `supabase/migrations/20260815150000_raa_exam_sessions_model.sql` para criar o modelo base de sessões de exame, componentes, resultados e pedidos de melhoria.

## Garantias do modelo

- `melhoria_nota_pedidos` não cria uma época autónoma: exige `exame_sessao_id`.
- `nota_resultado` usa `GREATEST(nota_anterior, nota_obtida)`.
- As sessões aceitam apenas exame nacional, recurso ou extraordinário.
- As modalidades combinadas são limitadas a escrita+oral e oral+prática.
- Todas as tabelas têm `escola_id`, RLS, índices de lookup e constraints de estado/nota.

## Risco

Médio: migration aditiva com quatro tabelas novas, RLS e uma função de acesso tenant. Não altera dados existentes nem tabelas financeiras/académicas atuais.

## Como aprovar

Commit com mensagem: `APPROVE: 2E7A1C44-RAA-SPRINT1-EXAM-MODEL`

## Como rejeitar

Commit com mensagem: `REJECT: 2E7A1C44-RAA-SPRINT1-EXAM-MODEL [motivo]`

## Aprovação recebida

`APPROVE: 2E7A1C44-RAA-SPRINT1-EXAM-MODEL`

## Estado

APPROVED. A migration foi aplicada no Supabase. As quatro tabelas, RLS, índices e triggers foram validados no catálogo PostgreSQL.
