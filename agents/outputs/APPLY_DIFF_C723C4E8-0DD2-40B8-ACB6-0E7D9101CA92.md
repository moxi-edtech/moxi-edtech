# Apply Diff — Navegação pela URL pública de Cobranças

run_id: C723C4E8-0DD2-40B8-ACB6-0E7D9101CA92  
data: 2026-08-01  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/radar/page.tsx`

## Objetivo

Evitar que o router interno do rewrite substitua o slug público pelo UUID ao abrir “Alunos e turmas”.

## Diff proposto

```diff
-import Link from "next/link";
-  const [alunosTurmasHref, setAlunosTurmasHref] = useState(...);
-  useEffect(() => { ... }, []);
-          <Link href={alunosTurmasHref}>Alunos e turmas</Link>
+          <button
+            type="button"
+            onClick={() => {
+              window.location.assign(new URL("../turmas-alunos", window.location.href).toString());
+            }}
+          >
+            Alunos e turmas
+          </button>
```

## Risco

Baixo. A ação faz navegação completa no mesmo origin, escola e portal visíveis, sem mutação de dados.

## Reversão

Restaurar o componente de link anterior.
