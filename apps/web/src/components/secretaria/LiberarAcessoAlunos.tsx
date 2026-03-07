"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAlunosSemAcesso } from "@/hooks/useAlunosSemAcesso";
// Nota do CTO: Vais precisar de criar este hook para ler os limites do plano do Supabase
import { useLimitesPlano } from "@/hooks/useLimitesPlano"; 
import { AlertCircle, Check, Loader2, Key, Users, ShieldAlert } from "lucide-react";

type Props = {
  escolaId: string;
};

export function LiberarAcessoAlunos({ escolaId }: Props) {
  const { alunos, loading: loadingAlunos, error, refetch } = useAlunosSemAcesso(escolaId);
  
  // O Novo Motor de Licenças (A simular a chamada)
  const { licencasUsadas, licencasTotais, loading: loadingLimites } = useLimitesPlano(escolaId); 
  const licencasDisponiveis =
    licencasTotais === null ? Number.POSITIVE_INFINITY : Math.max(0, licencasTotais - licencasUsadas);
  const licencasTotaisLabel = licencasTotais === null ? "Ilimitado" : String(licencasTotais);
  const licencasDisponiveisLabel =
    licencasTotais === null ? "∞" : String(Math.max(0, licencasTotais - licencasUsadas));

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [liberados, setLiberados] = useState<any[]>([]);

  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    // Trava de Segurança: Não deixar selecionar mais do que o limite do plano
    const limiteSeguro = alunos.slice(0, licencasDisponiveis);
    setSelecionados(limiteSeguro.map((a) => a.id));
  };

  const limparSelecao = () => setSelecionados([]);

  const handleLiberar = async () => {
    if (selecionados.length === 0) return;
    if (selecionados.length > licencasDisponiveis) {
      setMessage("Erro: A seleção excede o limite do seu plano atual.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setLiberados([]);
    
    try {
      const res = await fetch('/api/secretaria/alunos/liberar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escolaId, alunoIds: selecionados, canal: 'whatsapp', gerarCredenciais: true }),
      });
      const json = await res.json().catch(() => null);
      
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao liberar acesso');
      
      setLiberados(Array.isArray(json.detalhes) ? json.detalhes : []);
      setMessage(`${json.liberados} aluno(s) tiveram acesso liberado com sucesso.`);
      limparSelecao();
      refetch();
    } catch (e: any) {
      setMessage(e.message || 'Erro ao liberar acesso');
    } finally {
      setSubmitting(false);
    }
  };

  const pendentes = useMemo(() => alunos || [], [alunos]);
  const isOverLimit = selecionados.length > licencasDisponiveis;

  return (
    <Card className="rounded-xl shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-slate-100">
        <div>
          <CardTitle className="flex items-center gap-2 text-[#1F6B3B]">
            <Users className="w-5 h-5" />
            Ativação de Portal
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1 font-sora">
            Gere credenciais de acesso para alunos elegíveis.
          </p>
        </div>
        
        {/* PAINEL DE LICENÇAS (Upsell B2B) */}
          {!loadingLimites && (
            <div className="flex flex-col items-end rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Licenças Disponíveis</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${licencasTotais !== null && licencasDisponiveis <= 5 ? 'text-rose-600' : 'text-klasse-gold'}`}>
                  {licencasDisponiveisLabel}
                </span>
                <span className="text-sm text-slate-500">/ {licencasTotaisLabel}</span>
              </div>
              <span className="mt-1 text-[10px] text-slate-500">Usadas: {licencasUsadas}</span>
            </div>
          )}
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Alertas */}
        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl p-4 text-sm font-medium">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 text-[#1F6B3B] bg-green-50 border border-[#1F6B3B]/20 rounded-xl p-4 text-sm font-medium">
            <Check className="w-5 h-5" />
            {message}
          </div>
        )}

        {isOverLimit && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm font-medium">
            <ShieldAlert className="w-5 h-5" />
            Atenção: Selecionou mais alunos ({selecionados.length}) do que o seu plano permite ({licencasDisponiveis}). Faça um upgrade para continuar.
          </div>
        )}

        {/* Bloco de Credenciais Geradas */}
        {liberados.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-[#E3B23C]" />
              <h3 className="font-semibold text-slate-900 text-sm">Credenciais Prontas para Envio</h3>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {liberados.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.nome ?? "Aluno"}</p>
                    {item.status === "bi_missing" && <p className="text-xs text-red-600 mt-1">Falha: BI não cadastrado.</p>}
                  </div>
                  <div className="text-right font-geist text-sm">
                    <p className="text-slate-900 font-medium">{item.login || "—"}</p>
                    <p className="text-slate-500 text-xs">{item.senha || "Senha definida"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Alunos Pendentes */}
        {pendentes.length === 0 && !loadingAlunos ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Check className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm">Todos os alunos da base já possuem acesso.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {pendentes.map((aluno) => {
              const isActive = selecionados.includes(aluno.id);
              return (
                <label
                  key={aluno.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive 
                      ? 'border-[#E3B23C] bg-slate-50 ring-1 ring-[#E3B23C]/25' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleSelecionar(aluno.id)}
                    disabled={!isActive && selecionados.length >= licencasDisponiveis}
                    className="w-4 h-4 text-[#E3B23C] border-slate-300 rounded focus:ring-4 focus:ring-[#E3B23C]/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{aluno.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">ID: {aluno.codigo_ativacao || 'Pendente'}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-sm font-medium text-slate-500">
            <span className={isOverLimit ? "text-red-600 font-bold" : "text-slate-900"}>
              {selecionados.length}
            </span> selecionados
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="border-slate-200 rounded-xl text-slate-700 bg-white hover:bg-slate-50"
              onClick={limparSelecao} 
              disabled={selecionados.length === 0 || submitting}
            >
              Limpar
            </Button>
            <Button 
              className="bg-[#E3B23C] text-white rounded-xl hover:brightness-95 border-none shadow-sm"
              onClick={handleLiberar} 
              disabled={selecionados.length === 0 || submitting || isOverLimit}
              loading={submitting}
            >
              <Key className="w-4 h-4 mr-2" />
              Gerar Acessos
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
