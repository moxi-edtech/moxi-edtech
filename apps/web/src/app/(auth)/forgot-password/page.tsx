"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import BrandPanel from "../login/BrandPanel";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) return;

    try {
      setLoading(true);
      const origin = window.location.origin;
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/reset-password`,
      });
      setMessage("Se o email existir, enviamos um link de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Recuperar acesso</h1>
            <p className="text-sm text-slate-600 mt-1">
              Informe seu email. Se estiver cadastrado, enviaremos um link de redefinição.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Sem email? Solicite a redefinição na secretaria.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@escola.co.ao"
                required
              />
            </div>

            {message && <p className="text-center text-sm text-green-600 font-medium">{message}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => router.replace("/redirect")}
            className="w-full text-sm font-medium text-klasse-gold-600 hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}
