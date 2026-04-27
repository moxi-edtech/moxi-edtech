"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { toast } from "@/lib/toast";
import {
  isCorporatePreferredEmail,
  mapOtpVerificationError,
  resolveOnboardingWelcomeMessage,
} from "@/lib/talent-pool/onboarding";

const joinSchema = z.object({
  nome_empresa: z.string().trim().min(2, "Informe o nome da empresa."),
  nif: z.string().trim().min(9, "NIF deve ter pelo menos 9 caracteres."),
  nome_recrutador: z.string().trim().min(2, "Informe o nome do recrutador."),
  email: z.string().trim().email("Email inválido."),
});

type JoinData = z.infer<typeof joinSchema>;

type OnboardingResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  profile?: {
    is_verified?: boolean;
  };
};

type Props = {
  slug: string;
  partnerName: string;
  brandColor?: string | null;
  onCompleted: () => void;
};

function normalizeHex(color?: string | null): string {
  const value = String(color ?? "").trim();
  if (!value) return "#c8902a";
  const normalized = value.startsWith("#") ? value : `#${value}`;
  return /^#([a-fA-F0-9]{6})$/.test(normalized) ? normalized.toLowerCase() : "#c8902a";
}

export function B2BJoinForm({ slug, partnerName, brandColor, onCompleted }: Props) {
  const storageKey = `b2b-join:${slug}`;
  const primaryColor = useMemo(() => normalizeHex(brandColor), [brandColor]);

  const [step, setStep] = useState<"collect" | "verify">("collect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState<JoinData>({
    nome_empresa: "",
    nif: "",
    nome_recrutador: "",
    email: "",
  });

  useEffect(() => {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return;
    let decoded: unknown = null;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = joinSchema.safeParse(decoded);
    if (!parsed.success) return;
    setForm(parsed.data);
    setStep("verify");
  }, [storageKey]);

  function persistDraft(data: JoinData) {
    window.sessionStorage.setItem(storageKey, JSON.stringify(data));
  }

  function clearDraft() {
    window.sessionStorage.removeItem(storageKey);
  }

  async function handleCollectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = joinSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email.trim().toLowerCase(),
      });

      if (otpError) {
        setError(otpError.message);
        return;
      }

      persistDraft(parsed.data);
      setStep("verify");
      toast({
        title: "Código enviado",
        description: "Enviámos um OTP de 6 dígitos para o seu e-mail.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const token = otp.trim();
    if (!/^\d{6}$/.test(token)) {
      setError("Informe um código OTP de 6 dígitos.");
      return;
    }

    const parsed = joinSchema.safeParse(form);
    if (!parsed.success) {
      setError("Dados do registo expiraram. Refaça o formulário.");
      setStep("collect");
      clearDraft();
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const email = parsed.data.email.trim().toLowerCase();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });

      if (verifyError) {
        setError(mapOtpVerificationError(verifyError.message));
        return;
      }

      const response = await fetch("/api/formacao/publico/talent-pool/empresa-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = (await response.json().catch(() => null)) as OnboardingResponse | null;
      if (!response.ok || !json?.ok) {
        if (json?.code === "NIF_DUPLICADO") {
          setError("Este NIF já está registado. Por favor faça apenas login com o e-mail.");
          toast({
            title: "NIF já registado",
            description: "Use apenas o login por OTP com o e-mail da empresa.",
            variant: "destructive",
          });
          return;
        }
        setError(json?.error ?? "Falha ao concluir o onboarding da empresa.");
        return;
      }

      clearDraft();
      toast({
        title: "Bem-vindo!",
        description: resolveOnboardingWelcomeMessage(Boolean(json.profile?.is_verified)),
      });
      onCompleted();
    } finally {
      setLoading(false);
    }
  }

  const corporatePreferred = isCorporatePreferredEmail(form.email);

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="flex flex-col md:flex-row">
        {/* Benefits Sidebar */}
        <div className="bg-white/[0.03] p-8 md:w-72 lg:w-80">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m4 0h1m-5 4h1m4 0h1m-5 4h1m4 0h1" />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-black text-white leading-tight">Porta para Empresas</h2>
          <p className="mt-2 text-sm text-slate-400">Aceda a talentos qualificados pela {partnerName}.</p>
          
          <ul className="mt-8 space-y-6">
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Privacidade</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Dados dos alunos protegidos até o handshake.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Rapidez</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Recrutamento direto sem intermediários.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step === 'collect' ? 'bg-white text-slate-950 shadow-lg shadow-white/20' : 'bg-emerald-500 text-white'}`}>
              {step === 'verify' ? '✓' : '1'}
            </div>
            <div className="h-px w-8 bg-white/10" />
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step === 'verify' ? 'bg-white text-slate-950 shadow-lg shadow-white/20' : 'bg-white/5 text-slate-500'}`}>
              2
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-auto">
              {step === 'collect' ? 'Identificação' : 'Verificação OTP'}
            </span>
          </div>

          {step === "collect" ? (
            <form className="space-y-4" onSubmit={handleCollectSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                  Nome da empresa
                  <input
                    placeholder="Ex: Unitel"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                    value={form.nome_empresa}
                    onChange={(e) => setForm((curr) => ({ ...curr, nome_empresa: e.target.value }))}
                    disabled={loading}
                  />
                </label>

                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                  NIF da Empresa
                  <input
                    placeholder="5401xxxxxx"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                    value={form.nif}
                    onChange={(e) => setForm((curr) => ({ ...curr, nif: e.target.value }))}
                    disabled={loading}
                  />
                </label>
              </div>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Nome do recrutador / Responsável
                <input
                  placeholder="Ex: João Manuel"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                  value={form.nome_recrutador}
                  onChange={(e) => setForm((curr) => ({ ...curr, nome_recrutador: e.target.value }))}
                  disabled={loading}
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                E-mail corporativo
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                  value={form.email}
                  onChange={(e) => setForm((curr) => ({ ...curr, email: e.target.value }))}
                  placeholder="rh@empresa.ao"
                  disabled={loading}
                />
              </label>

              {form.email.trim() && !corporatePreferred ? (
                <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 text-[11px] text-amber-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  E-mail pessoal detectado. Acesso sujeito a quarentena para validação manual.
                </div>
              ) : null}

              {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}

              <button
                type="submit"
                className="mt-4 w-full rounded-xl px-4 py-4 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 shadow-xl shadow-white/5"
                style={{ backgroundColor: primaryColor }}
                disabled={loading}
              >
                {loading ? "A ENVIAR OTP..." : "SOLICITAR ACESSO À REDE"}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifySubmit}>
              <div className="text-center">
                <p className="text-sm text-slate-300">
                  Enviámos um código para <span className="font-bold text-white">{form.email}</span>.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">
                  Código de 6 dígitos
                </label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full max-w-[240px] rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-3xl font-black tracking-[0.5em] text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                />
              </div>

              {error ? <p className="text-sm font-bold text-center text-rose-500">{error}</p> : null}

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-4 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                  disabled={loading}
                >
                  {loading ? "A VALIDAR..." : "CONFIRMAR E ENTRAR"}
                </button>

                <button
                  type="button"
                  className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => {
                    setStep("collect");
                    setOtp("");
                    setError(null);
                    clearDraft();
                  }}
                  disabled={loading}
                >
                  ← Alterar e-mail ou dados
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
