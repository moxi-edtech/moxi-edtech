# Apply Diff — Resolver destino público após rewrite

run_id: C049D4E9-0638-41DF-9EF1-C9E0F0AF9EF0  
data: 2026-08-01  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/radar/page.tsx`

## Objetivo

Derivar no cliente o destino “Alunos e turmas” a partir da URL pública visível, preservando slug e namespace apesar do rewrite interno usar UUID.

## Diff proposto

```diff
 export default function SistemaCobrancas() {
+  const [alunosTurmasHref, setAlunosTurmasHref] = useState("../turmas-alunos");
+  useEffect(() => {
+    const currentPath = window.location.pathname.replace(/\/+$/, "");
+    const parentPath = currentPath.slice(0, currentPath.lastIndexOf("/"));
+    setAlunosTurmasHref(`${parentPath}/turmas-alunos`);
+  }, []);
...
-            href="../turmas-alunos"
+            href={alunosTurmasHref}
```

## Risco

Baixo. O valor inicial continua funcional sem JavaScript e é substituído pela URL pública canónica após montagem.

## Reversão

Remover o estado/efeito e restaurar o href relativo.
