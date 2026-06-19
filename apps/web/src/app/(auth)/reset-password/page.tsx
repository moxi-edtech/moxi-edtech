"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import BrandPanel from "../BrandPanel";

type Status = "loading" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");
  const [nextPwd, setNextPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [ok, setOk] = useState<string>("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const redirectWithSettledSession = useCallback(async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) break;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    window.location.replace("/redirect");
  }, [supabase]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const resolveSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setEmail(data.session.user.email || "");
        setStatus("ready");
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setEmail(session.user.email || "");
          setStatus("ready");
        }
      });
      unsub = () => {
        try {
          sub.subscription.unsubscribe();
        } catch {}
      };

      timeout = setTimeout(() => {
        setStatus((current) => (current === "ready" ? current : "invalid"));
      }, 4000);
    };

    resolveSession().catch(() => setStatus("invalid"));

    return () => {
      if (timeout) clearTimeout(timeout);
      if (unsub) unsub();
    };
  }, [supabase]);

  const passwordRules = (pwd: string) => [
    { ok: pwd.length >= 8, msg: "Pelo menos 8 caracteres" },
    { ok: /[A-Z]/.test(pwd), msg: "1 letra maiúscula" },
    { ok: /[a-z]/.test(pwd), msg: "1 letra minúscula" },
    { ok: /\d/.test(pwd), msg: "1 número" },
    { ok: /[^A-Za-z0-9]/.test(pwd), msg: "1 caractere especial" },
  ];

  const validatePassword = (pwd: string) => {
    const fail = passwordRules(pwd).find((r) => !r.ok);
    return fail?.msg || null;
  };

  const strengthInfo = useMemo(() => {
    const rules = passwordRules(nextPwd);
    const score = rules.filter((r) => r.ok).length;
    let label = "Muito fraca";
    let color = "bg-rose-500";
    if (score === 2) {
      label = "Fraca";
      color = "bg-amber-500";
    }
    if (score === 3) {
      label = "Média";
      color = "bg-yellow-500";
    }
    if (score === 4) {
      label = "Forte";
      color = "bg-emerald-500";
    }
    if (score >= 5) {
      label = "Excelente";
      color = "bg-klasse-green";
    }
    return { score, label, color, rules };
  }, [nextPwd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    const complexity = validatePassword(nextPwd);
    if (complexity) {
      setError(complexity);
      return;
    }
    if (nextPwd !== confirm) {
      setError("Confirmação não confere.");
      return;
    }

    try {
      setLoading(true);
      const { error: updErr } = await supabase.auth.updateUser({
        password: nextPwd,
        data: { must_change_password: false },
      });
      if (updErr) {
        setError(updErr.message);
        return;
      }

      setOk("Senha definida com sucesso.");
      window.setTimeout(() => {
        void redirectWithSettledSession();
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 bg-slate-50">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {status === "loading" ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-klasse-gold animate-pulse" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Validando acesso...</p>
            </div>
          ) : status === "invalid" ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Link inválido</h1>
                <p className="text-sm text-slate-500 leading-relaxed px-4">
                  O link de redefinição expirou ou já foi utilizado. Por segurança, solicite um novo envio.
                </p>
              </div>
              <Button 
                onClick={() => router.replace("/redirect")} 
                fullWidth 
                tone="blue"
                className="h-14 rounded-2xl font-black shadow-lg shadow-slate-200"
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-klasse-gold/10 flex items-center justify-center text-klasse-gold">
                    <Lock size={18} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segurança</span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Definir nova senha</h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Crie uma senha forte para proteger seu acesso à plataforma KLASSE.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Usuário (E-mail)</label>
                  <Input
                    className="bg-slate-50 text-slate-500 font-bold border-slate-100 rounded-2xl h-14"
                    value={email}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nova Senha</label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      className="rounded-2xl h-14 pr-12 font-mono font-bold border-slate-200 focus:border-slate-900 transition-all"
                      value={nextPwd}
                      onChange={(e) => setNextPwd(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  
                  {nextPwd && (
                    <PasswordStrength
                      score={strengthInfo.score}
                      label={strengthInfo.label}
                      color={strengthInfo.color}
                      rules={strengthInfo.rules}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirmar Senha</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      className="rounded-2xl h-14 pr-12 font-mono font-bold border-slate-200 focus:border-slate-900 transition-all"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-600 text-xs font-bold animate-in shake-1">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                {ok && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-600 text-xs font-bold animate-in zoom-in-95">
                    <CheckCircle2 size={16} className="shrink-0" />
                    {ok}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading || status !== "ready"} 
                  fullWidth
                  tone="gold"
                  className="h-16 rounded-[20px] font-black text-base shadow-xl shadow-klasse-gold/20 hover:scale-[1.02] transition-transform"
                >
                  {loading ? "Processando..." : "Atualizar Senha Agora"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({
  score,
  label,
  color,
  rules,
}: {
  score: number;
  label: string;
  color: string;
  rules: Array<{ ok: boolean; msg: string }>;
}) {
  return (
    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 animate-in fade-in duration-300">
      <div className="flex items-center justify-between text-[10px] mb-2 uppercase tracking-widest font-black">
        <span className="text-slate-400">Força da senha:</span>
        <span className={score > 0 ? "text-slate-900" : "text-slate-400"}>{label}</span>
      </div>
      <div className="flex gap-1.5 mb-4" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < score ? color : "bg-slate-200"}`} />
        ))}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {rules.map((r, idx) => (
          <li key={idx} className={`flex items-center gap-2 text-[10px] font-bold transition-colors ${r.ok ? "text-emerald-600" : "text-slate-400"}`}>
            {r.ok ? <CheckCircle2 size={12} className="shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0 ml-1" />}
            {r.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
