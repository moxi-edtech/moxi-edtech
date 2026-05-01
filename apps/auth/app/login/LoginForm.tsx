"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { loginAction } from "./actions";

type Props = { redirectTo: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-xl bg-klasse-gold px-4 py-3 font-semibold text-white shadow-sm hover:brightness-95 active:brightness-90 focus:outline-none focus:ring-4 focus:ring-klasse-gold/30 disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginForm({ redirectTo }: Props) {
  const [state, formAction] = useActionState(loginAction, { ok: true, message: "" });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <div className="text-2xl font-semibold tracking-tight text-klasse-green">Bem-vindo ao Klasse</div>
        <div className="mt-1 text-sm text-slate-600">Faça login para acessar sua conta.</div>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="redirect_to" value={redirectTo} />

        <div>
          <label className="text-sm font-medium text-slate-700">Identificador de acesso</label>
          <input
            name="identifier"
            type="text"
            autoComplete="username"
            required
            placeholder="Email ou número de processo"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
          />
          <p className="mt-1 text-xs text-slate-500">Alunos podem usar o número de processo.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Senha</label>
          <div className="relative mt-1">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {state?.ok === false ? <p className="text-sm text-red-600">{state.message}</p> : null}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded border-slate-300 text-klasse-gold focus:ring-klasse-gold"
            />
            <span className="text-sm font-medium text-slate-600">Lembrar-me</span>
          </label>
          <a href="/forgot-password" className="text-sm font-medium text-klasse-gold hover:underline">
            Recuperar acesso
          </a>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
