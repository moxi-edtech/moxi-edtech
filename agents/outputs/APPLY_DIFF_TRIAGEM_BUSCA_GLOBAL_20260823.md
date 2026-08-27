# Apply diff — Triagem: busca global contextual

run_id: TRIAGEM-BUSCA-GLOBAL-20260823

## Alteração proposta

Adicionar à área de Rematrícula uma busca global com debounce de 350 ms, usando a rota existente do Balcão. Selecionar um resultado abre somente o atendimento contextual do aluno e preserva a turma e a seleção da promoção em massa.

## Diff

```diff
+ campo "Localizar aluno na escola" por nome, processo ou BI
+ resultados limitados da rota /api/secretaria/balcao/alunos/search
+ ação "Abrir atendimento" por resultado
- placeholder ambíguo "Buscar aluno..."
+ placeholder explícito "Filtrar alunos desta turma..."
```

## Risco e reversão

Sem mutação de dados, schema ou políticas. A busca reutiliza o endpoint autorizado já usado pelo Balcão e é reversível com um único `git revert`.
