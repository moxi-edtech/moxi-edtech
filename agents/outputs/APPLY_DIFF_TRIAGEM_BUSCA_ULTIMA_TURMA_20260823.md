# Apply diff — Triagem: última turma na busca global

run_id: TRIAGEM-BUSCA-ULTIMA-TURMA-20260823

## Alteração proposta

Na rota de busca do Balcão, preferir a matrícula ativa e, na ausência dela, usar a matrícula mais recente do histórico. Expor uma etiqueta de contexto para a Triagem mostrar “Turma atual” ou “Última turma”.

## Diff

```diff
- turma: matriculaAtiva?.turmas?.nome || 'N/A'
+ matriculaReferencia: ativa ?? matrícula mais recente por ano_letivo
+ turma: matriculaReferencia?.turmas?.nome ?? null
+ turma_contexto: ativa ? 'Turma atual' : 'Última turma'
```

## Risco e reversão

Somente leitura e enriquecimento de resposta já autorizada; não altera dados, schema ou RLS. Reversível com um único `git revert`.
