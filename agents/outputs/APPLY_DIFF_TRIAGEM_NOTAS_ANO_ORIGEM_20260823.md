# Apply diff — Triagem: notas no ano de origem

run_id: TRIAGEM-NOTAS-ANO-ORIGEM-20260823

## Alteração proposta

Guardar o `id` do ano letivo de origem escolhido pela Triagem e passá-lo ao editor de notas. O `POST /api/secretaria/notas` deixará de inferir o ano ativo quando grava notas da turma de origem.

## Diff

```diff
- const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
+ const [originAcademicYearId, setOriginAcademicYearId] = useState<string | null>(null);
+ // ao abrir o editor: ano_letivo_id = originAcademicYearId
```

## Risco e reversão

Mudança limitada ao payload já suportado pela rota de notas; reversível com um único `git revert`.
