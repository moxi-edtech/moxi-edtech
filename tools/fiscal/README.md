
## AGT Oracle Evidence Builder

Executa cenarios AGT contra `POST /api/fiscal/compliance/oracle-validate`, valida KLASSE vs oraculo externo (Kwanzar via provider) e gera evidencias em `agents/outputs/fiscal/agt/`.

Exemplo:

```bash
pnpm tsx tools/fiscal/build-agt-evidence.ts \
  --base-url https://app.klasse.ao \
  --empresa-id <empresa_uuid> \
  --cookie 'sb-access-token=...; sb-refresh-token=...' \
  --escola-id <escola_uuid>
```

Saidas:
- `agents/outputs/fiscal/agt/FISCAL_ORACLE_VALIDATION_<timestamp>.json`
- `agents/outputs/fiscal/agt/FISCAL_ORACLE_VALIDATION_<timestamp>.md`
