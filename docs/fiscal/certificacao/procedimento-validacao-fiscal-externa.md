# Procedimento de Validacao Fiscal Externa — KLASSE

Data: 2026-03-28  
Escopo: integridade de `hash_control`, assinatura criptografica e cadeia fiscal por serie.

## 1) Mapeamento tecnico atual (schema real KLASSE)

Tabela principal: `public.fiscal_documentos`

- `hash_control`: coluna `hash_control` (text, NOT NULL).
- `assinatura`: coluna `assinatura_base64` (text, nullable por fluxo de assinatura asincrona).
- `key_version`: coluna `key_version` (integer, FK para `public.fiscal_chaves`).
- `hash anterior / cadeia`: coluna `hash_anterior` (text, nullable no primeiro documento da serie).
- payload canonico: coluna `canonical_string` (text), gerada pela RPC `public.fiscal_emitir_documento`.

Fonte do formato canonico:
- migrations da RPC fiscal (`supabase/migrations/20260326040000_fiscal_xml_context_rules.sql`).
- o formato e gerado por `jsonb_build_object(... )::text` no banco e persistido em `canonical_string`.
- validacao externa deve usar esse valor persistido; nao inventar outro formato.

## 2) Ferramentas de verificacao externa

Arquivos:
- `tools/fiscal/verify-hash-control.ts`
- `tools/fiscal/verify-signature.ts`
- `tools/fiscal/replay-audit.ts`

Dependencias:
- Node + `tsx`
- Variavel de conexao: `DB_URL` (ou `DATABASE_URL` / `SUPABASE_DB_URL`)

## 3) Como executar

## 3.1 Integridade hash_control

```bash
DB_URL='postgresql://...' pnpm tsx tools/fiscal/verify-hash-control.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --limit 500 \
  --json
```

Regra:
- `hash_control` deve ser igual a `sha256(canonical_string)` em hex.

## 3.2 Verificacao de assinatura

```bash
DB_URL='postgresql://...' pnpm tsx tools/fiscal/verify-signature.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --algorithm RSASSA_PSS_SHA_256 \
  --limit 200 \
  --json
```

Regra:
- assinatura e verificada com `public_key_pem` da `fiscal_chaves` da mesma `key_version`.
- algoritmo padrao vem de `fiscal_chaves.algorithm` (ou override por CLI).

## 3.3 Replay de auditoria da cadeia fiscal

```bash
DB_URL='postgresql://...' pnpm tsx tools/fiscal/replay-audit.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --date-from 2026-01-01 \
  --date-to 2026-12-31 \
  --algorithm RSASSA_PSS_SHA_256 \
  --json
```

Regras verificadas:
- cadeia por serie (`hash_anterior` = `hash_control` do documento anterior).
- integridade de hash (`sha256(canonical_string)`).
- assinatura valida contra chave publica.
- coerencia de evento `EMITIDO` em `fiscal_documentos_eventos`.

## 4) Criterios de aceite externo

- `verify-hash-control`: `status=PASS`.
- `verify-signature`: `status=PASS`.
- `replay-audit`: `status=PASS` com `total_blockers=0`.

## 5) Certificacao — criterio bloqueante

Se algum documento fiscal alvo tiver `assinatura_base64` ausente, isso deve ser tratado como:

**BLOQUEADOR de certificacao**

As ferramentas marcam isso explicitamente como blocker.

## 6) Evidencias a arquivar

- `agents/outputs/fiscal/FISCAL_HASH_VALIDATION_YYYYMMDD.md`
- `agents/outputs/fiscal/FISCAL_SIGNATURE_VALIDATION_YYYYMMDD.md`
- `agents/outputs/fiscal/FISCAL_REPLAY_AUDIT_YYYYMMDD.md`

Templates base:
- `agents/outputs/fiscal/templates/FISCAL_HASH_VALIDATION_TEMPLATE.md`
- `agents/outputs/fiscal/templates/FISCAL_SIGNATURE_VALIDATION_TEMPLATE.md`
- `agents/outputs/fiscal/templates/FISCAL_REPLAY_AUDIT_TEMPLATE.md`
