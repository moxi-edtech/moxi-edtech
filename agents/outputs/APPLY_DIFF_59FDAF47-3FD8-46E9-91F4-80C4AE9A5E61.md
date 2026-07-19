# Diff proposto — Agent 3
run_id: 59FDAF47-3FD8-46E9-91F4-80C4AE9A5E61
timestamp: 2026-07-19T04:05:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Desacoplar a inscrição Formação do email/user_id devolvidos pela RPC pública de precheck.

## Ficheiro proposto
`apps/formacao/app/api/formacao/admissoes/route.ts`

```diff
@@
-    if (!password) {
+    if (!password || !email) {
@@
-          email_hint: maskEmail(existingEmail || email),
+          email_hint: email ? maskEmail(email) : undefined,
@@
-    const loginEmail = existingEmail || email;
-    if (!loginEmail) {
-      return NextResponse.json(
-        { ok: false, error: "Não foi possível resolver email para confirmação de senha." },
-        { status: 409 }
-      );
-    }
-
     const { data: signInData, error: signInError } = await s.auth.signInWithPassword({
-      email: loginEmail,
+      email,
@@
-    if (String(signInData.user.id) !== existingUserId) {
-      return NextResponse.json({ ok: false, error: "Credenciais inválidas" }, { status: 401 });
-    }
-    formingUserId = existingUserId;
+    formingUserId = String(signInData.user.id);
+@@
+-  const existingEmail = normalizeEmail((precheck as { existing_email?: string | null } | null)?.existing_email);
+@@
+-    p_email: email || existingEmail || null,
++    p_email: email || null,
+@@
+-          email_hint: maskEmail(existingEmail || email),
++          email_hint: email ? maskEmail(email) : undefined,
```

## Verificação pós-apply prevista

- Typecheck/teste do workspace Formação.
- A rota deixa de usar o email completo e o UUID retornados pelo precheck para autenticar.
- Fluxo existente continua a fazer `signInWithPassword` antes da RPC protegida por `auth.uid()`.
