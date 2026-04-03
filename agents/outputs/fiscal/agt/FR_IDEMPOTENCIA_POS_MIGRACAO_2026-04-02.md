# Evidência — FR Idempotência Pós-Migração

data_utc: 2026-04-02
ambiente: produção (`https://app.klasse.ao`)
empresa_id: `11a6aba6-3315-4732-a0b1-383202cf4f9d`
escola_id: `f406f5a7-a077-431c-b118-297224925726`

## Contexto

- Correção aplicada para emissão fiscal FR:
  - `numero_formatado` padronizado para `TIPO PREFIXO/NUMERO`
  - dedupe idempotente para origem integrada via:
    - `metadata.origem_operacao`
    - `metadata.origem_id`
- Migração aplicada: `supabase/migrations/20260402133000_fix_fr_numero_formatado_idempotencia.sql`

## Pré-condição operacional

- Série semântica necessária para FR integrado criada/ativada:
  - tipo_documento: `FR`
  - prefixo: `FR`
  - origem_documento: `integrado`
  - serie_id: `94c3f591-7fe2-4f22-8d48-8201684a7af9`

## Teste executado

### Chamada 1 (origem_id A)

- HTTP: `201`
- documento_id: `0fcc55b7-e0fe-4f25-8199-05c1774a31b5`
- numero_formatado: `FR FR/1`

### Chamada 2 (mesmo origem_id A)

- HTTP: `201`
- documento_id: `0fcc55b7-e0fe-4f25-8199-05c1774a31b5`
- numero_formatado: `FR FR/1`

### Chamada 3 (origem_id B diferente)

- HTTP: `201`
- documento_id: `b35c8983-da83-4007-810c-e69c13bb2336`
- numero_formatado: `FR FR/2`

## Resultado

- `same_doc_1_2 = YES` (idempotência confirmada)
- `new_doc_3 = YES` (nova emissão para `origem_id` distinto confirmada)
- Status final: `PASS`
