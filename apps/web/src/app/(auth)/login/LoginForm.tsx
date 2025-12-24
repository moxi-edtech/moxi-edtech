"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
  const [state, formAction] = useActionState(loginAction, { ok: true, message: "" });

  return (
    <div>
      <div className="mb-6 klasse-anim-fade-up klasse-delay-1">
        <div className="text-2xl font-semibold text-[#1F6B3B] tracking-tight">
          Bem-vindo ao Klasse
        </div>
        <div className="mt-1 text-sm text-slate-600">
          Faça login para acessar sua conta.
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="klasse-anim-fade-up klasse-delay-2">
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

        <div className="klasse-anim-fade-up klasse-delay-3">
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

        {state?.ok === false && (
          <p className="text-sm text-red-600 klasse-anim-fade-in">{state.message}</p>
        )}

        <div className="flex items-center justify-end klasse-anim-fade-in klasse-delay-3">
          <a href="/forgot-password" className="text-sm font-medium text-[#B88712] hover:underline">
            Esqueceu a senha?
          </a>
        </div>

        <div className="klasse-anim-fade-up klasse-delay-4">
          <SubmitButton />
        </div>


      </form>
    </div>
  );
}