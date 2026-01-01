"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAlunosSemAcesso } from "@/hooks/useAlunosSemAcesso";
import { AlertCircle, CheckCircle, Loader2, Send, Users } from "lucide-react";

type Props = {
  escolaId: string;
};

export function LiberarAcessoAlunos({ escolaId }: Props) {
  const { alunos, loading, error, refetch } = useAlunosSemAcesso(escolaId);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    setSelecionados(alunos.map((a) => a.id));
  };

  const limparSelecao = () => setSelecionados([]);

  const handleLiberar = async () => {
    if (selecionados.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/secretaria/alunos/liberar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escolaId, alunoIds: selecionados, canal: 'whatsapp' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao liberar acesso');
      setMessage(`${json.liberados} aluno(s) tiveram acesso liberado.`);
      limparSelecao();
      refetch();
    } catch (e: any) {
      setMessage(e.message || 'Erro ao liberar acesso');
    } finally {
      setSubmitting(false);
    }
  };

  const pendentes = useMemo(() => alunos || [], [alunos]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            Liberar acesso ao portal
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Selecione alunos sem acesso e gere credenciais em lote.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {loading ? (
            <span className="flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> Carregando</span>
          ) : (
            <span>{pendentes.length} pendente(s)</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
            <CheckCircle className="w-4 h-4" />
            {message}
          </div>
        )}

        {pendentes.length === 0 && !loading ? (
          <div className="text-center text-sm text-slate-500 py-6">
            Todos os alunos elegíveis já têm acesso liberado.
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {pendentes.map((aluno) => (
              <label
                key={aluno.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition hover:border-teal-200 ${selecionados.includes(aluno.id) ? 'border-teal-400 bg-teal-50/60' : 'border-slate-200'}`}
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(aluno.id)}
                  onChange={() => toggleSelecionar(aluno.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{aluno.nome}</p>
                    <span className="text-xs text-slate-500">{aluno.codigo_ativacao || 'Sem código'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Telefone: {aluno.telefone || '—'}</p>
                  <p className="text-[11px] text-slate-400">Criado em: {aluno.criado_em ? new Date(aluno.criado_em).toLocaleDateString('pt-PT') : '—'}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-slate-500">{selecionados.length} selecionado(s)</div>
          <div className="flex gap-2">
            <Button variant="outline" tone="gray" size="sm" onClick={selecionarTodos} disabled={pendentes.length === 0 || submitting}>
              Selecionar todos
            </Button>
            <Button variant="outline" tone="gray" size="sm" onClick={limparSelecao} disabled={selecionados.length === 0 || submitting}>
              Limpar
            </Button>
            <Button tone="teal" size="sm" onClick={handleLiberar} disabled={selecionados.length === 0 || submitting} loading={submitting}>
              <Send className="w-4 h-4" /> Liberar acesso
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
