"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function AtivarAcessoPage() {
  const [codigo, setCodigo] = useState("");
  const [bi, setBi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/alunos/ativar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim(), bi: bi.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Erro ao ativar acesso');
      setResult({ ok: true, message: 'Acesso ativado. Verifique as credenciais enviadas pela escola.' });
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
            <CheckCircle className="w-5 h-5 text-emerald-600" /> Ativar acesso ao portal
          </CardTitle>
          <CardDescription>Informe o código recebido e o número do BI.</CardDescription>
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
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
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
