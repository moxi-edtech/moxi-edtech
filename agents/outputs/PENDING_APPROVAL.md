# Aprovação necessária — Agent 3
run_id:    F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC
timestamp: 2026-07-18T12:37:08Z

## Acção proposta
Criar o primeiro lote de correções do DB lint em quatro RPCs ativas, sem alterar assinaturas, retornos, grants ou contratos externos.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC.md
```

## Risco
Baixo: as mudanças apenas corrigem tipos SQLSTATE/JSONB e qualificam referências ambíguas; ainda assim, um erro na recriação das funções pode afetar IA, health dashboard, reimpressão ou venda avulsa.

## Como aprovar
Commit com mensagem: `APPROVE: F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC`

## Como rejeitar
Commit com mensagem: `REJECT: F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC [motivo]`
