"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function AtivarAcessoPage() {
  const [codigo, setCodigo] = useState("");
  const [bi, setBi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; login?: string; senha?: string; created?: boolean } | null>(null);
  const [resolvedEscola, setResolvedEscola] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const escolaParam = searchParams?.get("escola")?.trim() ?? "";
  const tokenParam = searchParams?.get("token")?.trim() ?? "";
  const escolaLabel = formatEscolaLabel(escolaParam);

  useEffect(() => {
    const codigoParam = searchParams?.get("codigo");
    if (codigoParam && !codigo) {
      setCodigo(codigoParam.trim().toUpperCase());
    }
  }, [searchParams, codigo]);

  useEffect(() => {
    let active = true;
    if (!tokenParam) {
      setResolvedEscola(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/alunos/ativar-acesso/escola?token=${encodeURIComponent(tokenParam)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok && json?.ok && typeof json?.escola === "string") {
          setResolvedEscola(json.escola);
        }
      } catch {
        if (active) setResolvedEscola(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [tokenParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/alunos/ativar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim(), bi: bi.trim(), escola: escolaParam || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Erro ao ativar acesso');
      setResult({
        ok: true,
        message: json?.created
          ? 'Acesso ativado. Use as credenciais abaixo para o primeiro login.'
          : 'Acesso já estava ativo. Use as suas credenciais ou peça um reset de senha.',
        login: json?.login,
        senha: json?.senha || undefined,
        created: Boolean(json?.created),
      });
      setCodigo('');
      setBi('');
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Falha ao ativar acesso' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CheckCircle className="w-5 h-5 text-klasse-green-600" /> Ativar acesso ao portal
          </CardTitle>
          <CardDescription>Informe o código recebido e o número do BI.</CardDescription>
          {(resolvedEscola || escolaParam) && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Escola: {resolvedEscola ?? escolaLabel}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Código de ativação"
              placeholder="KLASSE-XXXXXX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              required
            />
            <Input
              label="Número do BI"
              placeholder="000000000LA0XX"
              value={bi}
              onChange={(e) => setBi(e.target.value)}
              required
            />
            <Button type="submit" fullWidth loading={loading} tone="teal">
              Ativar acesso
            </Button>
          </form>

          {result && (
            <div
              className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
                result.ok
                  ? 'bg-klasse-green-50 border-klasse-green-200 text-klasse-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
            </div>
          )}

          {result?.ok && result.login && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Credenciais de acesso</p>
              <p className="mt-2">
                <span className="font-medium">Login:</span> {result.login}
              </p>
              {result.senha ? (
                <p className="mt-1">
                  <span className="font-medium">Senha temporária:</span> {result.senha}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Se não lembra a senha, peça um reset para a secretaria.
                </p>
              )}
              {result.created && (
                <p className="mt-2 text-xs text-slate-500">
                  No primeiro login será solicitado definir uma nova senha.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500 space-y-1">
            <p className="font-semibold">Como obter o código?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Peça à secretaria da escola.</li>
              <li>Verifique a mensagem enviada para o encarregado.</li>
              <li>Formato: KLASSE-XXXXXX.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatEscolaLabel(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return "Escola selecionada";
  }
  const cleaned = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return cleaned.replace(/(^|\s)([a-zà-ÿ])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
}
