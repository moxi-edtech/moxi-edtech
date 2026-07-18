# Aprovação necessária — Agent 3
run_id:    3BF04896-A308-4059-AA04-62DF08A0D2FA
timestamp: 2026-07-18T13:03:08Z

## Acção proposta
Adicionar o schema confiável `extensions` ao search path de quatro funções de pesquisa que usam `pg_trgm` e `unaccent`.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_3BF04896-A308-4059-AA04-62DF08A0D2FA.md
```

## Risco
Baixo: apenas permite resolver funções de extensões já instaladas, sem alterar assinaturas, queries ou ranking.

## Como aprovar
Commit com mensagem: `APPROVE: 3BF04896-A308-4059-AA04-62DF08A0D2FA`

## Como rejeitar
Commit com mensagem: `REJECT: 3BF04896-A308-4059-AA04-62DF08A0D2FA [motivo]`
