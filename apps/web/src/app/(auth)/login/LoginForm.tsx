"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="mt-5 w-full rounded-xl bg-[#E3B23C] px-4 py-3 font-semibold text-white
                 shadow-sm hover:brightness-95 active:brightness-90
                 focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/30 disabled:opacity-60"
      type="submit"
      disabled={pending}
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, { ok: true, message: "" });

  return (
    <div>
      {/* Top logo mini (placeholder) */}
      <div className="mb-6">
        <div className="text-2xl font-semibold text-[#1F6B3B] tracking-tight">Bem-vindo ao Klasse</div>
        <div className="mt-1 text-sm text-slate-600">Faça login para acessar sua conta.</div>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3
                       text-slate-900 placeholder:text-slate-400
                       focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20 focus:border-[#E3B23C]"
            placeholder="seuemail@escola.co.ao"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Senha</label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3
                       text-slate-900 placeholder:text-slate-400
                       focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20 focus:border-[#E3B23C]"
            placeholder="••••••••"
          />
        </div>

        {/* Mensagem genérica (anti enumeração) */}
        {state?.ok === false && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        <div className="flex items-center justify-end">
          <a href="/forgot-password" className="text-sm font-medium text-[#B88712] hover:underline">
            Esqueceu a senha?
          </a>
        </div>

        <SubmitButton />

        <div className="pt-2 text-center text-sm text-slate-600">
          Ainda não tem uma conta?{" "}
          <a href="/signup" className="font-semibold text-[#1F6B3B] hover:underline">
            Criar conta
          </a>
        </div>
      </form>
    </div>
  );
}