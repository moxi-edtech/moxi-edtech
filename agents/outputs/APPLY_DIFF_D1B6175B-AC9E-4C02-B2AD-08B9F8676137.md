# Apply Diff — Navegação simétrica em Alunos e turmas

run_id: D1B6175B-AC9E-4C02-B2AD-08B9F8676137  
data: 2026-08-01  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/turmas-alunos/page.tsx`

## Objetivo

Adicionar o mesmo seletor simples usado em Cobranças, permitindo alternar diretamente entre Inadimplência e Alunos e turmas.

## Diff proposto

```diff
       </div>
+      <nav aria-label="Vistas de cobranças">
+        <button type="button" onClick={() => window.location.assign(new URL("../radar", window.location.href).toString())}>
+          Inadimplência
+        </button>
+        <span aria-current="page">Alunos e turmas</span>
+      </nav>
```

## Risco

Baixo. Apenas navegação no mesmo origin, escola e contexto visíveis.

## Reversão

Remover o bloco de navegação adicionado.
