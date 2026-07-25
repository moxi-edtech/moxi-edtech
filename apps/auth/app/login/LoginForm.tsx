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
      className="mt-6 h-[58px] w-full rounded-2xl bg-[#073b2c] px-4 text-[15px] font-bold text-white shadow-[0_18px_42px_rgba(7,59,44,0.24)] transition hover:bg-[#0d4b38] hover:shadow-[0_20px_48px_rgba(7,59,44,0.28)] active:translate-y-px focus:outline-none focus:ring-4 focus:ring-[#073b2c]/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar no portal"}
    </button>
  );
}

export default function LoginForm({ redirectTo }: Props) {
  const [state, formAction] = useActionState(loginAction, { ok: true, message: "" });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <div className="mb-7 flex items-center gap-3 md:hidden">
        <img
          src="/klasse-mark-isolated.png"
          alt=""
          width={42}
          height={42}
          className="h-[42px] w-[42px] object-contain"
        />
        <span className="font-[Inter,ui-sans-serif,system-ui,sans-serif]">
          <strong className="block text-sm font-[950] leading-none tracking-[0.16em] text-[#073b2c]">
            KLASSE
          </strong>
          <small className="mt-1 block text-[8px] font-black uppercase leading-none tracking-[0.12em] text-[#f9a51a]">
            Gestão escolar inteligente
          </small>
        </span>
      </div>

      <div className="mb-8 text-left">
        <div className="text-[27px] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-[#073b2c]">
          Acesse o KLASSE
        </div>
        <div className="mt-2.5 max-w-[340px] text-sm font-normal leading-6 text-[#17211d]/55">
          Continue a gestão da escola com segurança, clareza e controle.
        </div>
      </div>

      <form action={formAction} className="space-y-5" suppressHydrationWarning>
        <input type="hidden" name="redirect_to" value={redirectTo} />

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.08em] text-[#17211d]/70">
            Identificador de acesso
          </label>
          <input
            name="identifier"
            type="text"
            autoComplete="username"
            required
            placeholder="Email ou número de processo"
            suppressHydrationWarning
            className="mt-2 h-14 w-full rounded-[14px] border border-[#073b2c]/15 bg-white/85 px-4 text-[15px] font-medium text-[#17211d] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:font-normal placeholder:text-[#17211d]/35 focus:border-[#073b2c]/45 focus:ring-4 focus:ring-[#073b2c]/8"
          />
          <p className="mt-2 text-xs text-[#17211d]/50">Alunos podem usar o número de processo.</p>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.08em] text-[#17211d]/70">Senha</label>
          <div className="relative mt-2">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              suppressHydrationWarning
              className="h-14 w-full rounded-[14px] border border-[#073b2c]/15 bg-white/85 px-4 pr-12 text-[15px] font-medium text-[#17211d] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:font-normal placeholder:text-[#17211d]/35 focus:border-[#073b2c]/45 focus:ring-4 focus:ring-[#073b2c]/8"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 grid -translate-y-1/2 place-items-center rounded-lg p-1 text-[#17211d]/40 transition hover:bg-[#073b2c]/5 hover:text-[#073b2c] focus:outline-none focus:ring-2 focus:ring-[#073b2c]/15"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {state?.ok === false ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {state.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              name="remember"
              suppressHydrationWarning
              className="h-4 w-4 rounded border-[#073b2c]/25 accent-[#073b2c] focus:ring-[#073b2c]"
            />
            <span className="text-sm font-medium text-[#17211d]/60">Lembrar-me</span>
          </label>
          <a
            href="/forgot-password"
            className="text-sm font-semibold text-[#073b2c] underline-offset-4 hover:underline"
          >
            Recuperar acesso
          </a>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
