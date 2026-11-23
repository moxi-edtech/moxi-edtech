"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAlunosSemAcesso } from "@/hooks/useAlunosSemAcesso";
// Nota do CTO: Vais precisar de criar este hook para ler os limites do plano do Supabase
import { useLimitesPlano } from "@/hooks/useLimitesPlano"; 
import { AlertCircle, Check, Loader2, Key, Users, ShieldAlert, Copy, ClipboardCheck } from "lucide-react";

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const text = liberados
      .filter(item => item.login && item.senha)
      .map(item => `Aluno: ${item.nome}\nLogin: ${item.login}\nSenha: ${item.senha}\n---`)
      .join('\n');
    
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

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
    <Card className="rounded-xl shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-border">
        <div>
          <CardTitle className="flex items-center gap-2 text-klasse-green dark:text-klasse-green-300">
            <Users className="w-5 h-5" />
            Ativação de Portal
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1 font-sora">
            Gere credenciais de acesso para alunos elegíveis.
          </p>
        </div>
        
        {/* PAINEL DE LICENÇAS (Upsell B2B) */}
          {!loadingLimites && (
            <div className="flex flex-col items-end rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Licenças Disponíveis</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${licencasTotais !== null && licencasDisponiveis <= 5 ? 'text-rose-600' : 'text-amber'}`}>
                  {licencasDisponiveisLabel}
                </span>
                <span className="text-sm text-muted-foreground">/ {licencasTotaisLabel}</span>
              </div>
              <span className="mt-1 text-[10px] text-muted-foreground">Usadas: {licencasUsadas}</span>
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
          <div className="flex items-center gap-2 text-klasse-green dark:text-klasse-green-300 bg-green-50 border border-klasse-green/20 rounded-xl p-4 text-sm font-medium">
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
          <div className="rounded-xl border border-border bg-muted p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-klasse-gold-700 dark:text-klasse-gold-300" />
                <h3 className="font-semibold text-foreground text-sm">Credenciais Prontas</h3>
              </div>
              <button
                onClick={handleCopyAll}
                className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {copiedId === 'all' ? (
                  <><ClipboardCheck className="w-3 h-3 text-green-600" /> Copiado</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar Tudo</>
                )}
              </button>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {liberados.map((item) => (
                <div key={item.id} className="group relative flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:border-klasse-gold/30 transition-all">
                  <div className="min-w-0 pr-8">
                    <p className="text-sm font-semibold text-foreground truncate">{item.nome ?? "Aluno"}</p>
                    {item.status === "bi_missing" && <p className="text-xs text-red-600 mt-1 font-medium">Falha: BI não cadastrado.</p>}
                    {item.status === "activation_failed" && <p className="text-xs text-amber-600 mt-1 font-medium">Acesso liberado, mas falha ao ativar credenciais.</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right font-geist text-sm">
                      <p className="text-foreground font-medium">{item.login || "—"}</p>
                      <p className="text-muted-foreground text-xs">{item.senha || "Senha definida"}</p>
                    </div>
                    {(item.login && item.senha) && (
                      <button
                        onClick={() => handleCopy(`Aluno: ${item.nome}\nLogin: ${item.login}\nSenha: ${item.senha}`, item.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-klasse-gold-700 dark:hover:text-klasse-gold-300 transition-all"
                        title="Copiar credenciais"
                      >
                        {copiedId === item.id ? (
                          <ClipboardCheck className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Alunos Pendentes */}
        {pendentes.length === 0 && !loadingAlunos ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Check className="w-8 h-8 text-muted-foreground mb-2" />
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
                      ? 'border-klasse-gold bg-muted ring-1 ring-klasse-gold/25'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleSelecionar(aluno.id)}
                    disabled={!isActive && selecionados.length >= licencasDisponiveis}
                    className="w-4 h-4 text-klasse-gold-700 dark:text-klasse-gold-300 border-border rounded focus:ring-4 focus:ring-klasse-gold/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{aluno.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ID: {aluno.codigo_ativacao || 'Pendente'}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm font-medium text-muted-foreground">
            <span className={isOverLimit ? "text-red-600 font-bold" : "text-foreground"}>
              {selecionados.length}
            </span> selecionados
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="border-border rounded-xl text-foreground bg-card hover:bg-muted"
              onClick={limparSelecao} 
              disabled={selecionados.length === 0 || submitting}
            >
              Limpar
            </Button>
            <Button 
              className="bg-klasse-gold text-klasse-gold-900 rounded-xl hover:brightness-95 border-none shadow-sm"
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
