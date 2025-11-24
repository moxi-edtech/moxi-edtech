import { supabaseServer } from "@/lib/supabaseServer";
import { Users, Clock, Calendar, Building } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const s = await supabaseServer();
  const { data: turmas } = await s
    .from('turmas')
    .select('id, nome, turno, ano_letivo, sala')
    .eq('escola_id', escolaId)
    .order('nome');

  // Calcular métricas para o dashboard
  const totalTurmas = turmas?.length || 0;
  const turnos = turmas?.reduce((acc, turma) => {
    const turno = turma.turno || 'Não definido';
    acc[turno] = (acc[turno] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const turnoMaisComum = Object.entries(turnos).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{totalTurmas}</div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Total de Turmas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {Object.keys(turnos).length}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Turnos Diferentes
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {turnoMaisComum}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Turno Mais Comum
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {turmas?.filter(t => t.sala).length || 0}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Building className="h-4 w-4" />
            Com Sala Definida
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Turmas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalTurmas} turmas cadastradas • {Object.keys(turnos).length} turnos diferentes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all">
            <Users className="h-4 w-4" />
            Exportar Lista
          </button>

          <button className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5">
            <Users className="h-4 w-4" />
            Nova Turma
          </button>
        </div>
      </div>

      {/* --- TABELA DE TURMAS --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nome da Turma
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Turno
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ano Letivo
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Sala
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(!turmas || turmas.length === 0) ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhuma turma cadastrada.
                    <div className="mt-2 text-sm">
                      Comece criando sua primeira turma.
                    </div>
                  </td>
                </tr>
              ) : (
                turmas.map((turma) => (
                  <tr key={turma.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-slate-900">
                      <div className="font-bold text-moxinexa-navy">
                        {turma.nome}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        ID: {turma.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {turma.turno ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          <Clock className="w-3 h-3 mr-1" />
                          {turma.turno}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {turma.ano_letivo ? (
                        <span className="text-slate-700 font-medium">{turma.ano_letivo}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {turma.sala ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                          <Building className="w-3 h-3 mr-1" />
                          {turma.sala}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        ● Ativa
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- FOOTER COM INFORMAÇÕES ADICIONAIS --- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <span className="font-bold">📊 Distribuição por Turno:</span>
            {Object.entries(turnos).map(([turno, count]) => (
              <span key={turno} className="bg-slate-100 px-2 py-1 rounded text-xs">
                {turno}: {count}
              </span>
            ))}
          </p>
          <p className="mt-2 text-slate-500">
            💡 <strong>Dica:</strong> Organize as turmas por turno e sala para melhor gestão do espaço físico.
          </p>
        </div>
      </div>
    </div>
  );
}
