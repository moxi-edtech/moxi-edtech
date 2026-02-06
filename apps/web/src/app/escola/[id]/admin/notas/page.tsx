import { supabaseServer } from "@/lib/supabaseServer";
import { BookOpen, Search, Filter, ArrowUpDown, Users, BookCheck, GraduationCap, BarChart3 } from "lucide-react";

export const dynamic = 'force-dynamic';

type Search = { q?: string; orderBy?: string; dir?: string; page?: string; pageSize?: string };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<Search> }) {
  const { id: escolaId } = await params;
  const sp = (await searchParams) || {};
  const q = (sp.q || '').trim();
  const orderBy = (sp.orderBy || 'recentes');
  const dir = (sp.dir || (orderBy === 'nota' ? 'desc' : 'desc')).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.pageSize || '20', 10) || 20));
  const s = await supabaseServer();

  // Ajustado ao schema atual:
  // - notas: matricula_id, avaliacao_id, valor
  // - joins manuais com matriculas/avaliacoes/disciplinas
  let total = 0;
  let notas: Array<{
    id: string;
    nota: number | null;
    aluno_id: string | null;
    turma_id: string | null;
    aluno?: string | null;
    turma?: string | null;
    disciplina?: string | null;
    created_at?: string | null;
  }> = [];

  // Métricas
  let mediaGeral = 0;
  let totalAvaliacoes = 0;
  const disciplinasUnicas = new Set<string>();
  const turmasUnicas = new Set<string>();

  // Contagem total
  {
    const countQuery = s
      .from('notas')
      .select('id', { count: 'exact', head: true })
      .eq('escola_id', escolaId);
    const { count } = await countQuery;
    total = count || 0;
  }

  // Busca dados paginados
  {
    let dataQuery = s
      .from('notas')
      .select('id, valor, matricula_id, avaliacao_id, created_at')
      .eq('escola_id', escolaId)
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (orderBy === 'nota') dataQuery = dataQuery.order('valor', { ascending: dir === 'asc' });
    else dataQuery = dataQuery.order('created_at', { ascending: dir === 'asc' });

    const { data } = await dataQuery;
    const rows = (data || []) as Array<{
      id: string;
      valor: number | null;
      matricula_id: string | null;
      avaliacao_id: string | null;
      created_at: string | null;
    }>;

    // Coleta IDs para join manual
    const matriculaIds = Array.from(new Set(rows.map(r => r.matricula_id).filter(Boolean))) as string[];
    const avaliacaoIds = Array.from(new Set(rows.map(r => r.avaliacao_id).filter(Boolean))) as string[];

    // Dicionários auxiliares
    const alunoNomeById = new Map<string, string | null>();
    const turmaNomeById = new Map<string, string | null>();

    const matriculaById = new Map<string, { aluno_id: string | null; turma_id: string | null }>();
    if (matriculaIds.length > 0) {
      const { data: matriculas } = await s
        .from('matriculas')
        .select('id, aluno_id, turma_id')
        .in('id', matriculaIds);
      for (const m of (matriculas || []) as Array<{ id: string; aluno_id: string | null; turma_id: string | null }>) {
        matriculaById.set(m.id, { aluno_id: m.aluno_id, turma_id: m.turma_id });
      }
    }

    const alunoIds = Array.from(new Set(Array.from(matriculaById.values()).map(r => r.aluno_id).filter(Boolean))) as string[];
    const turmaIds = Array.from(new Set(Array.from(matriculaById.values()).map(r => r.turma_id).filter(Boolean))) as string[];

    if (alunoIds.length > 0) {
      const { data: alunos } = await s.from('alunos').select('id, nome').in('id', alunoIds);
      for (const a of (alunos || []) as Array<{ id: string; nome: string }>) {
        alunoNomeById.set(a.id, a.nome ?? null);
      }
    }
    if (turmaIds.length > 0) {
      const { data: turmas } = await s.from('turmas').select('id, nome').in('id', turmaIds);
      for (const t of (turmas || []) as Array<{ id: string; nome: string }>) {
        turmaNomeById.set(t.id, t.nome ?? null);
      }
    }

    const avaliacaoById = new Map<string, string | null>();
    if (avaliacaoIds.length > 0) {
      const { data: avaliacoes } = await s
        .from('avaliacoes')
        .select('id, turma_disciplina_id')
        .in('id', avaliacaoIds);
      for (const av of (avaliacoes || []) as Array<{ id: string; turma_disciplina_id: string | null }>) {
        avaliacaoById.set(av.id, av.turma_disciplina_id);
      }
    }

    const turmaDiscIds = Array.from(new Set(Array.from(avaliacaoById.values()).filter(Boolean))) as string[];
    const turmaDisciplinaById = new Map<string, string | null>();
    const disciplinaById = new Map<string, { nome: string; sigla: string | null }>();
    if (turmaDiscIds.length > 0) {
      const { data: turmaDisciplinas } = await s
        .from('turma_disciplinas')
        .select('id, curso_matriz_id')
        .in('id', turmaDiscIds);
      
      const cursoMatrizIds = Array.from(new Set((turmaDisciplinas || []).map((td: any) => td.curso_matriz_id).filter(Boolean))) as string[];
      const cursoMatrizMap = new Map<string, string | null>();

      if (cursoMatrizIds.length > 0) {
        const { data: cursoMatrizes } = await s
          .from('curso_matriz')
          .select('id, disciplina_id')
          .in('id', cursoMatrizIds);
        for (const cm of (cursoMatrizes || []) as Array<{ id: string; disciplina_id: string | null }>) {
          cursoMatrizMap.set(cm.id, cm.disciplina_id);
        }
      }

      for (const td of (turmaDisciplinas || []) as Array<{ id: string; curso_matriz_id: string | null }>) {
        if (td.curso_matriz_id) {
          const disciplinaId = cursoMatrizMap.get(td.curso_matriz_id) || null;
          turmaDisciplinaById.set(td.id, disciplinaId);
        }
      }

      const disciplinaIds = Array.from(new Set(Array.from(turmaDisciplinaById.values()).filter(Boolean))) as string[];
      if (disciplinaIds.length > 0) {
        const { data: disciplinas } = await s
          .from('disciplinas_catalogo')
          .select('id, nome, sigla')
          .in('id', disciplinaIds);
        for (const d of (disciplinas || []) as Array<{ id: string; nome: string; sigla: string | null }>) {
          disciplinaById.set(d.id, { nome: d.nome, sigla: d.sigla });
        }
      }
    }
    const disciplinaLabelByTurmaDiscId = new Map<string, string>();
    for (const [turmaDiscId, disciplinaId] of turmaDisciplinaById.entries()) {
      if (!disciplinaId) continue;
      const disciplina = disciplinaById.get(disciplinaId);
      if (disciplina) disciplinaLabelByTurmaDiscId.set(turmaDiscId, disciplina.sigla || disciplina.nome);
    }

    notas = rows.map((row) => {
      const matricula = row.matricula_id ? matriculaById.get(row.matricula_id) : null;
      const alunoId = matricula?.aluno_id ?? null;
      const turmaId = matricula?.turma_id ?? null;
      const alunoNome = alunoId ? alunoNomeById.get(alunoId) ?? null : null;
      const turmaNome = turmaId ? turmaNomeById.get(turmaId) ?? null : null;

      const turmaDiscId = row.avaliacao_id ? avaliacaoById.get(row.avaliacao_id) ?? null : null;
      const disciplinaNome = turmaDiscId ? disciplinaLabelByTurmaDiscId.get(turmaDiscId) ?? null : null;

      if (row.valor !== null) {
        mediaGeral += row.valor;
        totalAvaliacoes++;
      }
      if (disciplinaNome) disciplinasUnicas.add(disciplinaNome);
      if (turmaNome) turmasUnicas.add(turmaNome);

      return {
        id: row.id,
        nota: row.valor ?? null,
        aluno_id: alunoId,
        turma_id: turmaId,
        aluno: alunoNome,
        turma: turmaNome,
        disciplina: disciplinaNome,
        created_at: row.created_at ?? null,
      }
    });
  }

  mediaGeral = totalAvaliacoes > 0 ? mediaGeral / totalAvaliacoes : 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const makeUrl = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (orderBy) params.set('orderBy', orderBy);
    if (dir) params.set('dir', dir);
    if (page) params.set('page', String(page));
    if (pageSize) params.set('pageSize', String(pageSize));
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{total}</div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BookCheck className="h-4 w-4" />
            Total de Notas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {mediaGeral.toFixed(1)}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Média Geral
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {disciplinasUnicas.size}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Disciplinas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {turmasUnicas.size}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Turmas
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Notas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} notas lançadas • {disciplinasUnicas.size} disciplinas • {turmasUnicas.size} turmas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all">
            <BarChart3 className="h-4 w-4" />
            Relatório
          </button>

          <button className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5">
            <BookCheck className="h-4 w-4" />
            Lançar Notas
          </button>
        </div>
      </div>

      {/* --- FILTROS E PESQUISA --- */}
      <form method="get" className="flex gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            name="q" 
            defaultValue={q} 
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
            placeholder="Buscar por disciplina ou avaliação..."
          />
        </div>
        
        <div className="flex gap-2">
          <select name="orderBy" defaultValue={orderBy} className="border border-slate-200 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal">
            <option value="recentes">Mais recentes</option>
            <option value="nota">Nota</option>
          </select>
          
          <select name="dir" defaultValue={dir} className="border border-slate-200 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          
          <button 
            type="submit" 
            className="inline-flex items-center gap-2 px-4 py-3 bg-moxinexa-teal text-white rounded-lg hover:bg-teal-600 transition-all"
          >
            <Filter className="h-4 w-4" />
            Aplicar
          </button>
        </div>
      </form>

      {/* --- TABELA DE NOTAS --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aluno
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Turma
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Avaliação
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Disciplina
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nota
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {notas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhuma nota encontrada.
                    <div className="mt-2 text-sm">
                      {q ? 'Tente ajustar os filtros de busca.' : 'Comece lançando as primeiras notas.'}
                    </div>
                  </td>
                </tr>
              ) : (
                notas.map((nota) => {
                  const notaValue = nota.nota ?? null;
                  const status = notaValue === null ? 'pending' : notaValue >= 10 ? 'approved' : 'recovery';
                  
                  return (
                    <tr key={nota.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-slate-900">
                        <div className="font-bold text-moxinexa-navy">
                          {nota.aluno || (
                            <span className="text-slate-400">Aluno não identificado</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {nota.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {nota.turma ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                            <Users className="w-3 h-3 mr-1" />
                            {nota.turma}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        —
                      </td>
                      <td className="px-4 py-3">
                        {nota.disciplina ? (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {nota.disciplina}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {notaValue !== null ? (
                          <div className={`font-mono font-bold text-lg ${
                            notaValue >= 10 ? 'text-green-600' : 
                            notaValue >= 5 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {notaValue.toFixed(1)}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status === 'approved' && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            ✓ Aprovado
                          </span>
                        )}
                        {status === 'recovery' && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                            ⚠ Recuperação
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                            ⌛ Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- PAGINAÇÃO --- */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          Mostrando <strong>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> notas
        </div>
        <div className="flex gap-2">
          <a 
            className={`inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm ${
              page <= 1 ? 'pointer-events-none opacity-50 text-slate-400' : 'text-slate-700 hover:bg-slate-50'
            }`} 
            href={makeUrl({ page: Math.max(1, page-1) })}
          >
            ← Anterior
          </a>
          
          <span className="px-3 py-2 text-sm text-slate-600">
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          
          <a 
            className={`inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm ${
              page >= totalPages ? 'pointer-events-none opacity-50 text-slate-400' : 'text-slate-700 hover:bg-slate-50'
            }`} 
            href={makeUrl({ page: Math.min(totalPages, page+1) })}
          >
            Próxima →
          </a>
        </div>
      </div>
    </div>
  );
}
