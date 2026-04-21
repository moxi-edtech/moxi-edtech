"use client";

import { useMemo, useState } from "react";

type Props = {
  centroSlug: string;
  cohortRef: string;
  centroNome: string;
  cohortNome: string;
  cursoNome: string;
};

type ApiState = {
  ok: boolean;
  message: string;
  code?: string;
  emailHint?: string | null;
};

const initialState: ApiState = { ok: true, message: "" };

export default function InscricaoSelfServiceForm({
  centroSlug,
  cohortRef,
  centroNome,
  cohortNome,
  cursoNome,
}: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [biNumero, setBiNumero] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [state, setState] = useState<ApiState>(initialState);

  const passwordLabel = useMemo(() => {
    if (requirePassword) return "Senha da conta existente";
    return "Senha de acesso";
  }, [requirePassword]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setState(initialState);

    try {
      const res = await fetch("/api/formacao/admissoes", {
        method: "POST",
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        body: JSON.stringify({
          via: "self_service",
          centro_slug: centroSlug,
          cohort_ref: cohortRef,
          nome,
          email,
          bi_numero: biNumero,
          telefone,
          password: password || undefined,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            code?: string;
            email_hint?: string | null;
          }
        | null;

      if (!res.ok || !body?.ok) {
        const code = String(body?.code ?? "");
        const message = String(body?.error ?? "Não foi possível concluir a inscrição.");
        if (code === "PASSWORD_REQUIRED" || code === "ACCOUNT_EXISTS_USE_PASSWORD") {
          setRequirePassword(true);
        }
        setState({ ok: false, message, code, emailHint: body?.email_hint ?? null });
        return;
      }

      setState({
        ok: true,
        message: `Inscrição confirmada em ${cursoNome} (${cohortNome}) do ${centroNome}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no envio.";
      setState({ ok: false, message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nome completo</label>
        <input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#2B6044] focus:ring-2 focus:ring-[#2B6044]/20"
          placeholder="Seu nome"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">BI</label>
          <input
            value={biNumero}
            onChange={(event) => setBiNumero(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#2B6044] focus:ring-2 focus:ring-[#2B6044]/20"
            placeholder="Ex: 001234567LA049"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
          <input
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#2B6044] focus:ring-2 focus:ring-[#2B6044]/20"
            placeholder="923000000"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#2B6044] focus:ring-2 focus:ring-[#2B6044]/20"
          placeholder="voce@email.com"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{passwordLabel}</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required={requirePassword}
          minLength={requirePassword ? 8 : 0}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#2B6044] focus:ring-2 focus:ring-[#2B6044]/20"
          placeholder={requirePassword ? "Confirme a senha da conta já existente" : "Defina sua senha (mín. 8 caracteres)"}
        />
        {!requirePassword ? (
          <p className="mt-1 text-xs text-slate-500">
            Se já existir cadastro com este BI, vamos pedir confirmação de senha.
          </p>
        ) : null}
      </div>

      {!state.ok && state.message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p>{state.message}</p>
          {state.emailHint ? <p className="mt-1 text-xs">Conta encontrada: {state.emailHint}</p> : null}
        </div>
      ) : null}

      {state.ok && state.message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#E3B23C] px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "A processar..." : "Inscrever-me"}
      </button>
    </form>
  );
}
