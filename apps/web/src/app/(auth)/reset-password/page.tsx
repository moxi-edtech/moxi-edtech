"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import BrandPanel from "../login/BrandPanel";

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
    let color = "bg-red-500";
    if (score === 2) {
      label = "Fraca";
      color = "bg-klasse-gold-500";
    }
    if (score === 3) {
      label = "Média";
      color = "bg-yellow-500";
    }
    if (score === 4) {
      label = "Forte";
      color = "bg-green-600";
    }
    if (score >= 5) {
      label = "Excelente";
      color = "bg-moxinexa-teal";
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
      setTimeout(() => router.replace("/redirect"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          {status === "invalid" ? (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold text-slate-900">Link inválido</h1>
              <p className="text-sm text-slate-600">
                O link de redefinição expirou ou já foi utilizado. Solicite um novo envio.
              </p>
              <Button onClick={() => router.replace("/redirect")} className="w-full">
                Voltar ao login
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Definir nova senha</h1>
                <p className="text-sm text-slate-600 mt-1">Crie uma senha segura para acessar a plataforma.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">E-mail</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 bg-slate-50"
                    value={email}
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Nova senha</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    value={nextPwd}
                    onChange={(e) => setNextPwd(e.target.value)}
                    required
                    disabled={status !== "ready"}
                  />
                  {nextPwd && (
                    <PasswordStrength
                      score={strengthInfo.score}
                      label={strengthInfo.label}
                      color={strengthInfo.color}
                      rules={strengthInfo.rules}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirmar nova senha</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={status !== "ready"}
                  />
                </div>

                {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}
                {ok && <p className="text-center text-sm text-green-600 font-medium">{ok}</p>}

                <Button type="submit" disabled={loading || status !== "ready"} className="w-full">
                  {loading ? "Salvando..." : "Salvar nova senha"}
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
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">Força da senha:</span>
        <span className="font-medium text-gray-800">{label}</span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i < score ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        {rules.map((r, idx) => (
          <li key={idx} className={r.ok ? "text-green-600" : "text-gray-500"}>
            {r.ok ? "✓" : "•"} {r.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
