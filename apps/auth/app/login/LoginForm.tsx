"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";

type Props = { redirectTo: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        borderRadius: 12,
        border: "1px solid #111827",
        background: "#111827",
        color: "#fff",
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 600,
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginForm({ redirectTo }: Props) {
  const [state, formAction] = useActionState(loginAction, { ok: true, message: "" });

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="redirect_to" value={redirectTo} />

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#334155" }}>Identificador</span>
        <input
          name="identifier"
          type="text"
          required
          placeholder="Email ou número de processo"
          style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", fontSize: 14 }}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#334155" }}>Senha</span>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••"
          style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", fontSize: 14 }}
        />
      </label>

      {state?.ok === false ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{state.message}</p> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <a href="https://app.klasse.ao/forgot-password" style={{ fontSize: 13, color: "#334155" }}>
          Recuperar acesso
        </a>
        <SubmitButton />
      </div>
    </form>
  );
}
