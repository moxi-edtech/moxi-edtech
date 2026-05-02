"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackFunnelClient } from "@/lib/funnel-client";
import { AlertCircle, Clock, Info, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    onloadTurnstileCallback: () => void;
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      getResponse: (widgetId: string) => string;
      reset: (widgetId: string) => void;
    };
  }
}

type Props = {
  centroSlug: string;
  cohortRef: string;
  centroNome: string;
  cohortNome: string;
  cursoNome: string;
  vagasTotal: number;
  vagasOcupadas: number;
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
  vagasTotal,
  vagasOcupadas,
}: Props) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [biNumero, setBiNumero] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [state, setState] = useState<ApiState>(initialState);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carrega o script do Turnstile
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: "1x00000000000000000000AA", // Chave de teste (Sempre passa)
          callback: (token: string) => {
            setTurnstileToken(token);
          },
        });
      }
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const isSoldOut = vagasTotal > 0 && vagasOcupadas >= vagasTotal;
  const vagasRestantes = Math.max(0, vagasTotal - vagasOcupadas);
  const showScarcity = !isSoldOut && vagasTotal > 0 && vagasRestantes <= 5;

  const passwordLabel = useMemo(() => {
    if (requirePassword) return "Senha da conta existente";
    return "Senha de acesso";
  }, [requirePassword]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    
    if (!turnstileToken) {
      setState({ ok: false, message: "Por favor, complete a verificação de segurança." });
      return;
    }

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
          captcha_token: turnstileToken,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            code?: string;
            email_hint?: string | null;
            is_waitlist?: boolean;
          }
        | null;

      if (!res.ok || !body?.ok) {
        const code = String(body?.code ?? "");
        const message = String(body?.error ?? "Não foi possível concluir a inscrição.");
        if (code === "PASSWORD_REQUIRED" || code === "ACCOUNT_EXISTS_USE_PASSWORD") {
          setRequirePassword(true);
        }
        trackFunnelClient({
          event: "self_service_inscricao_submit_failed",
          stage: "inscricao",
          source: "inscricao_self_service_form",
          details: { centro_slug: centroSlug, cohort_ref: cohortRef, code, reason: message },
        });
        setState({ ok: false, message, code, emailHint: body?.email_hint ?? null });
        return;
      }

      trackFunnelClient({
        event: "self_service_inscricao_submit_success",
        stage: "inscricao",
        source: "inscricao_self_service_form",
        details: { centro_slug: centroSlug, cohort_ref: cohortRef, is_waitlist: !!body.is_waitlist },
      });

      // Redireciona para página de sucesso com dados
      const params = new URLSearchParams({
        nome,
        curso: cursoNome,
        waitlist: body.is_waitlist ? "true" : "false",
      });
      router.push(`/inscricao/concluido?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no envio.";
      trackFunnelClient({
        event: "self_service_inscricao_submit_failed",
        stage: "inscricao",
        source: "inscricao_self_service_form",
        details: { centro_slug: centroSlug, cohort_ref: cohortRef, reason: message },
      });
      setState({ ok: false, message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isSoldOut ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
          <div className="flex items-start gap-3">
            <Clock className="text-amber-600 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-amber-900">Turma Lotada</p>
              <p className="text-xs text-amber-800 mt-1">
                Ainda pode registar o seu interesse. Vamos inseri-lo na <strong>Lista de Espera</strong> e avisar se houver desistências ou novas turmas.
              </p>
            </div>
          </div>
        </div>
      ) : showScarcity ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-emerald-600 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-emerald-900">Últimas Vagas!</p>
              <p className="text-xs text-emerald-800 mt-1">
                Restam apenas <strong>{vagasRestantes} vagas</strong> disponíveis para esta turma. Garanta a sua agora.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Cloudflare Turnstile Widget */}
      <div className="flex justify-center py-2">
        <div ref={turnstileRef} />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#E3B23C] px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "A processar..." : isSoldOut ? "Entrar na Lista de Espera" : "Confirmar Inscrição"}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-2">
        <Info size={12} /> Protegido por Cloudflare Turnstile
      </div>
    </form>
  );
}
