# KLASSE — Apply Diff
run_id: 3DBDF647-7807-4DE8-AE76-23698C1CAA07
timestamp: 2026-08-23T13:50:08Z

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão em PASS.

## Alteração proposta

Separar elegibilidade académica para reserva da pendência financeira: todos os alunos seguem para validação RAA da RPC, enquanto a dívida permanece sinalizada para bloquear somente a activação final.

## Diff

```diff
-        if (saldo <= tolerance) {
-            aptos.push(info);
-        } else {
+        aptos.push(info);
+        if (saldo > tolerance) {
             inadimplentes.push(info);
         }
```

## Reversão

Reversível num único `git revert` do commit correspondente.
