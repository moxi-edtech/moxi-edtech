# Resultado do apply — DB lint, lote 8 pesquisa
run_id: 3BF04896-A308-4059-AA04-62DF08A0D2FA
approval_commit: f12d43a23c996429bb2cba90b45a7af180bb5e7b
status: PARTIAL

## Resultado

- `search_alunos_global`: PASS
- `search_alunos_global_min(uuid,text,integer)`: PASS
- Overload paginado de `search_alunos_global_min`: REVERTED
- `search_global_entities`: REVERTED

As duas funções paginadas revelaram referências ambíguas a `score`. O rollback
seletivo do `search_path` foi aplicado.

## Métrica

- Erros antes: 49
- Erros depois: 47
- Redução líquida: 2

