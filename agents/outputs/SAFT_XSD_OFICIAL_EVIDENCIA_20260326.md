# Evidência — Fase 5 Hardening Final (XSD Oficial + Consumidor Final)

data: 2026-03-26
ambiente: local (http://localhost:3000)
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
escola_id: f406f5a7-a077-431c-b118-297224925726

## Resultado

- Exportação SAF-T com XSD oficial: **HTTP 201**.
- Validador XSD refatorado para usar `SAF-T-AO1.01_01.xsd`.
- Erros de validação agora reportam linha e nó exatos (ex.: linha/nó em `failures[0]`).
- Regra de consumidor final com fallback de morada (`Desconhecido`) aplicada de ponta a ponta (schema/API/XML).

## Evidências técnicas

- XSD oficial adicionado em:
  - `apps/web/src/lib/fiscal/xsd/SAF-T-AO1.01_01.xsd`
- Validador endurecido:
  - `apps/web/src/lib/fiscal/saftXsdValidator.ts`
- Builder SAF-T atualizado (namespace oficial + header + customer/billing address):
  - `apps/web/src/lib/fiscal/saftAo.ts`
- Normalização de consumidor final na entrada:
  - `apps/web/src/lib/schemas/fiscal-documento.schema.ts`
  - `apps/web/src/app/api/fiscal/documentos/route.ts`
  - `apps/web/src/app/api/fiscal/saft/export/route.ts`

## Estado

Gap crítico de infraestrutura XSD oficial: **fechado**.
Gap alto de fallback de morada do consumidor final: **fechado**.
