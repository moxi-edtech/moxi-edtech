"use client";

import { useMatriculaLogic } from "@/hooks/useMatriculaLogic"; // Importe o hook acima
import { User, Building, Wallet, CheckCircle2, ArrowRight, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// --- SUB-COMPONENTES (Podem ir para arquivos separados) ---

const HeaderMatricula = ({ onClose }: { onClose: () => void }) => (
  <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-50">
    <div className="flex items-center gap-4">
      <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
        <X className="w-5 h-5" />
      </button>
      <h1 className="text-lg font-bold text-slate-900">Nova Matrícula</h1>
    </div>
    <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400">
      {/* Steps visualizer simplificado */}
      <StepBadge icon={User} label="Seleção" active />
      <span className="w-4 h-px bg-slate-300" />
      <StepBadge icon={Building} label="Alocação" />
      <span className="w-4 h-px bg-slate-300" />
      <StepBadge icon={CheckCircle2} label="Confirmação" />
    </div>
  </header>
);

const StepBadge = ({ icon: Icon, label, active }: any) => (
  <span className={cn("flex items-center gap-1", active ? "text-klasse-gold font-bold" : "")}>
    <Icon className="w-3 h-3" /> {label}
  </span>
);

const ResumoFinanceiro = ({ orcamento, loading, disabled, onSubmit, submitting }: any) => {
  if (loading)
    return (
      <div className="p-8">
        <Loader2 className="animate-spin text-klasse-gold" />
      </div>
    );

  const total = (orcamento?.valor_matricula ?? 0) + (orcamento?.valor_mensalidade ?? 0) + 3500; // Exemplo

  return (
    <aside className="hidden lg:flex flex-col w-[380px] bg-white border-l border-slate-200 p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-klasse-green/10 rounded-xl text-klasse-green">
          <Wallet className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-lg">Resumo Financeiro</h3>
      </div>

      <div className="flex-1 space-y-4">
        {orcamento ? (
          <>
            <LineItem label="Matrícula" value={orcamento.valor_matricula} />
            <LineItem label="Mensalidade" value={orcamento.valor_mensalidade} />
            <LineItem label="Taxas" value={3500} />
            <div className="h-px bg-slate-200 my-4" />
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-slate-400">TOTAL</span>
              <span className="text-2xl font-black text-klasse-green">{total.toLocaleString()} Kz</span>
            </div>
          </>
        ) : (
          <div className="p-6 bg-slate-50 border border-dashed rounded-xl text-center text-slate-500 text-sm">
            Selecione a turma para calcular.
          </div>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={disabled || submitting}
        className={cn(
          "w-full py-4 rounded-xl font-bold text-white shadow-sm flex items-center justify-center gap-2",
          disabled ? "bg-slate-200 text-slate-400" : "bg-klasse-gold hover:brightness-95"
        )}
      >
        {submitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            Confirmar <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </aside>
  );
};

const LineItem = ({ label, value }: any) => (
  <div className="flex justify-between text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-bold text-slate-900">{value?.toLocaleString()} Kz</span>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function NovaMatriculaPage() {
  // 1. Injetamos a lógica
  const { state, data, selection, setSelection, derived, actions } = useMatriculaLogic();

  // Helpers locais para UI
  const handleSelectCandidatura = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelection((prev) => ({ ...prev, candidaturaId: e.target.value, turmaId: "" }));

  if (state.loading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-klasse-gold" />
      </div>
    );

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sora">
      <HeaderMatricula onClose={() => window.history.back()} />

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* COLUNA DA ESQUERDA (FORMULÁRIO) */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-32 space-y-8">
          {/* STEP 1: QUEM */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                1
              </span>
              <h2 className="text-lg font-bold">Quem vamos matricular?</h2>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <select
                className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-klasse-gold"
                value={selection.candidaturaId}
                onChange={handleSelectCandidatura}
              >
                <option value="">Selecione a candidatura...</option>
                {data.candidaturas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_candidato || "Sem Nome"} - {c.cursos?.nome}
                  </option>
                ))}
              </select>

              {derived.alunoAtivo && (
                <div className="mt-6 flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-klasse-green/20 text-klasse-green flex items-center justify-center font-bold text-xl">
                    {derived.alunoAtivo.nome[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{derived.alunoAtivo.nome}</p>
                    <p className="text-sm text-slate-500">
                      Curso Pretendido: {derived.candidaturaAtiva?.cursos?.nome}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2: ONDE (Só aparece se tiver aluno) */}
          <section
            className={cn(
              "space-y-4 transition-opacity",
              !selection.candidaturaId && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                2
              </span>
              <h2 className="text-lg font-bold">Para onde vai?</h2>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Seletor de Ano */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ano Letivo</label>
                  <select
                    className="w-full mt-1 p-3 bg-white rounded-xl border border-slate-200"
                    disabled={!data.sessions.length}
                    value={selection.sessionId}
                    onChange={(e) => setSelection((prev) => ({ ...prev, sessionId: e.target.value }))}
                  >
                    <option value="" disabled>
                      {data.sessions.length ? "Selecione o ano letivo..." : "Nenhum ano letivo disponível"}
                    </option>
                    {data.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toggle Tipo */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Modalidade</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => setSelection((prev) => ({ ...prev, destinoTipo: "classe" }))}
                      className={cn(
                        "p-3 rounded-xl font-bold text-sm",
                        selection.destinoTipo === "classe" ? "bg-slate-900 text-white" : "bg-slate-50"
                      )}
                    >
                      Por Classe
                    </button>
                    <button
                      onClick={() => setSelection((prev) => ({ ...prev, destinoTipo: "curso" }))}
                      className={cn(
                        "p-3 rounded-xl font-bold text-sm",
                        selection.destinoTipo === "curso" ? "bg-slate-900 text-white" : "bg-slate-50"
                      )}
                    >
                      Por Curso
                    </button>
                  </div>
                </div>
              </div>

              {/* Filtros Dinâmicos (Lógica Simplificada na UI) */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Aqui entrariam os selects de filtros (Curso/Classe) baseados no destinoTipo */}
                {/* Para brevidade, mostramos apenas o Select de Turma final que depende dos filtros */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Turma Final</label>
                  <select
                    className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200"
                    value={selection.turmaId}
                    onChange={(e) => setSelection((prev) => ({ ...prev, turmaId: e.target.value }))}
                  >
                    <option value="">Selecione a turma...</option>
                    {data.turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.turno}) - {t.ocupacao_atual || 0} vagas ocup.
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* COLUNA DA DIREITA (RESUMO) */}
        <ResumoFinanceiro
          orcamento={state.orcamento}
          loading={state.loadingOrcamento}
          disabled={!selection.candidaturaId || !selection.turmaId}
          submitting={state.submitting}
          onSubmit={actions.submitMatricula}
        />
      </div>
    </div>
  );
}
