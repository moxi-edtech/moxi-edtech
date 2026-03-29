# AGT Certification Go-Live Pack — KLASSE Fiscal

Data: 2026-03-27  
Owner: David (Produto) + Engenharia Fiscal  
Status: **NO-GO controlado** (próximo de GO)

## 1) Objetivo

Fechar os últimos bloqueios para submissão AGT com evidência auditável, rastreável e reproduzível.

## 2) Gate de Aprovação (GO/NO-GO)

Critério de **GO**:
- P0 = 100% concluído.
- P1 = 100% concluído (incluindo aprovação formal de política).
- P2 = submissão administrativa AGT concluída com comprovativos.
- Evidências anexadas em `agents/outputs/` e documentos de `docs/academico/`.

Se qualquer item acima falhar: **NO-GO**.

## 3) Matriz de Entregáveis Finais

| Bloco | Item | Status | Evidência obrigatória | Owner |
|---|---|---|---|---|
| P0 | Smoke E2E autenticado em produção | [ ] | `agents/outputs/fiscal/FISCAL_SMOKE_PROD_YYYYMMDD.md` | Eng |
| P0 | Export SAF-T válido no XSD oficial | [ ] | `agents/outputs/fiscal/SAFT_XSD_PROD_YYYYMMDD.md` | Eng |
| P0 | Trilha de auditoria export/retry/download | [ ] | print SQL + JSON de API + UI screenshot | Eng |
| P0 | Validação independente de `hash_control` em produção | [ ] | `agents/outputs/fiscal/FISCAL_HASH_VALIDATION_PROD_YYYYMMDD.md` | Eng |
| P0 | Validação independente de assinatura com chave pública em produção | [ ] | `agents/outputs/fiscal/FISCAL_SIGNATURE_VALIDATION_PROD_YYYYMMDD.md` | Eng |
| P0 | Replay audit histórico concluído em produção | [ ] | `agents/outputs/fiscal/FISCAL_REPLAY_AUDIT_PROD_YYYYMMDD.md` | Eng |
| P1 | Política retenção/acesso ledger aprovada formalmente | [ ] | aprovação assinada + versão final da política | Produto/Compliance |
| P1 | Dossiê técnico consolidado | [ ] | `docs/fiscal/certificacao/fiscal-certificacao-dossie.md` atualizado | Eng |
| P2 | Modelo 8 + upload chave pública `.txt` | [ ] | comprovativo AGT (PDF/screenshot protocolo) | Administrativo |

## 4) Evidências Técnicas Mínimas (produção)

## 4.1 Smoke E2E
- Executar suíte completa no ambiente de produção.
- Guardar outputs HTTP por etapa (`probe`, FT, FT isenta, RC, retificação, anulação, PDF, SAF-T).
- Registrar `request_id` de cada chamada.

## 4.2 XSD Oficial
- Exportar SAF-T em produção.
- Validar contra `SAF-T-AO1.01_01.xsd`.
- Em caso de falha, anexar `line`, `node` e `message` do validador.

## 4.3 Auditoria de Reexportação
- Executar um ciclo:
  1. Exportação inicial.
  2. Retry via `POST /api/fiscal/saft/export/[exportId]/retry`.
  3. Download do artefato final.
- Confirmar em `audit_logs`:
  - `FISCAL_SAFT_EXPORT_REQUESTED`
  - `FISCAL_SAFT_EXPORT_RETRY_REQUESTED`
  - `FISCAL_SAFT_EXPORT_RETRY_QUEUED` (ou `_QUEUE_FAILED`)

## 4.4 Verificação Externa de Integridade e Assinatura
- Executar em produção os utilitários:
  - `tools/fiscal/verify-hash-control.ts`
  - `tools/fiscal/verify-signature.ts`
  - `tools/fiscal/replay-audit.ts`
- Cobrir no mínimo:
  - 1 FT válida
  - 1 RC válida
  - 1 documento retificado/anulado (quando aplicável)
- Anexar os 3 relatórios:
  - `agents/outputs/fiscal/FISCAL_HASH_VALIDATION_PROD_YYYYMMDD.md`
  - `agents/outputs/fiscal/FISCAL_SIGNATURE_VALIDATION_PROD_YYYYMMDD.md`
  - `agents/outputs/fiscal/FISCAL_REPLAY_AUDIT_PROD_YYYYMMDD.md`

## 4.5 Caso Negativo Obrigatório (Hardening de Auditoria)
- Executar ao menos 1 cenário controlado de falha:
  - `hash_control` divergente, ou
  - assinatura inválida, ou
  - quebra de cadeia (`hash_anterior` divergente)
- Resultado esperado:
  - script retorna `FAIL`
  - issue/blocker explícito no relatório
- Evidência:
  - `agents/outputs/fiscal/FISCAL_NEGATIVE_VALIDATION_PROD_YYYYMMDD.md`

## 5) Queries de Verificação (copiar/colar)

```sql
-- Últimas exportações SAF-T
select id, empresa_id, periodo_inicio, periodo_fim, status, checksum_sha256, arquivo_storage_path, created_at
from public.fiscal_saft_exports
order by created_at desc
limit 20;
```

```sql
-- Trilhas de auditoria SAF-T/retry
select created_at, acao, entity_id, details
from public.audit_logs
where tabela = 'fiscal_saft_exports'
  and acao in (
    'FISCAL_SAFT_EXPORT_REQUESTED',
    'FISCAL_SAFT_EXPORT_RETRY_REQUESTED',
    'FISCAL_SAFT_EXPORT_RETRY_QUEUED',
    'FISCAL_SAFT_EXPORT_RETRY_QUEUE_FAILED'
  )
order by created_at desc
limit 100;
```

## 6) Checklist de Fecho (assinatura)

- [ ] P0 fechado
- [ ] P1 fechado
- [ ] P2 fechado
- [ ] Evidências anexadas e revisadas
- [ ] Aprovação final GO emitida

Assinaturas:
- Engenharia Fiscal: ____________________
- Produto: ____________________
- Compliance/Administrativo: ____________________
- Data/hora: ____________________

## 7) Riscos Residuais (antes do GO)

1. Ambiente de produção sem evidência E2E recente.
2. Aprovação formal da política de retenção ainda pendente.
3. Comprovativo administrativo AGT ainda não anexado.
