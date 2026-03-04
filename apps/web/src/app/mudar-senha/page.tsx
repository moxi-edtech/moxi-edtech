"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { createClient } from "@/lib/supabaseClient";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function MudarSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user && active) {
        router.replace("/login");
      }
    })();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);

    if (!senha || senha.length < 8) {
      setResult({ ok: false, message: "A senha deve ter pelo menos 8 caracteres." });
      return;
    }

    if (senha !== confirmacao) {
      setResult({ ok: false, message: "As senhas não coincidem." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false, primeiro_acesso: false },
      });
      if (error) throw error;
      setResult({ ok: true, message: "Senha atualizada. Redirecionando..." });
      setTimeout(() => router.replace("/redirect"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar senha";
      setResult({ ok: false, message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CheckCircle className="w-5 h-5 text-klasse-green-600" /> Definir nova senha
          </CardTitle>
          <CardDescription>Por segurança, escolha uma nova senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nova senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <Input
              label="Confirmar senha"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
            />
            <Button type="submit" fullWidth loading={loading} tone="teal">
              Atualizar senha
            </Button>
          </form>

          {result && (
            <div
              className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
                result.ok
                  ? "bg-klasse-green-50 border-klasse-green-200 text-klasse-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
