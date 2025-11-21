"use client";
import { useEffect, useMemo, useState } from 'react'

type Item = { id: string; curso_id: string | null; classe_id: string | null; valor: number; dia_vencimento: number | null; ativo: boolean; created_at?: string };
type Ref = { id: string; nome: string };

export default function TabelasMensalidadeClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [classes, setClasses] = useState<Ref[]>([]);
  const [cursos, setCursos] = useState<Ref[]>([]);

  // filtros
  const [fCurso, setFCurso] = useState<string>("");
  const [fClasse, setFClasse] = useState<string>("");
  const filtered = useMemo(() => {
    return items.filter(it => (!fCurso || it.curso_id === fCurso) && (!fClasse || it.classe_id === fClasse));
  }, [items, fCurso, fClasse]);

  // form (create/update)
  const [editId, setEditId] = useState<string | null>(null);
  const [cursoId, setCursoId] = useState<string>("");
  const [classeId, setClasseId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [dia, setDia] = useState<string>("");
  const [applyExisting, setApplyExisting] = useState<boolean>(false);
  const [applyPast, setApplyPast] = useState<boolean>(false);
  const [ativo, setAtivo] = useState<boolean>(true);

  const loadAll = async () => {
    setLoading(true); setError(null); setOk(null);
    try {
      const [r0, r1, r2] = await Promise.all([
        fetch('/api/financeiro/tabelas-mensalidade', { cache: 'no-store' }),
        fetch('/api/secretaria/classes', { cache: 'no-store' }),
        fetch('/api/secretaria/cursos', { cache: 'no-store' }),
      ]);
      const j0 = await r0.json(); const j1 = await r1.json(); const j2 = await r2.json();
      if (!j0?.ok) throw new Error(j0?.error || 'Falha ao carregar regras');
      setItems(j0.items || []);
      setClasses(j1.items || []);
      setCursos(j2.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const resetForm = () => {
    setEditId(null); setCursoId(""); setClasseId(""); setValor(""); setDia(""); setAtivo(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setOk(null);
    try {
      if (!valor) throw new Error('Informe o valor');
      const payload: any = { valor: Number(valor), ativo };
      if (cursoId) payload.curso_id = cursoId; else payload.curso_id = null;
      if (classeId) payload.classe_id = classeId; else payload.classe_id = null;
      if (dia) payload.dia_vencimento = Number(dia);
      const res = await fetch('/api/financeiro/tabelas-mensalidade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || 'Falha ao salvar');
      // Aplicação opcional aos existentes
      if (applyExisting) {
        const applyPayload: any = { valor: Number(valor) };
        if (dia) applyPayload.dia_vencimento = Number(dia);
        if (cursoId) applyPayload.curso_id = cursoId;
        if (classeId) applyPayload.classe_id = classeId;
        if (applyPast) applyPayload.scope = 'all';
        const r2 = await fetch('/api/financeiro/tabelas-mensalidade/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(applyPayload) });
        const j2 = await r2.json();
        if (!r2.ok || !j2.ok) throw new Error(j2?.error || 'Falha ao aplicar aos existentes');
        setOk(`Regra salva e aplicada (${j2.updated} mensalidade(s) atualizadas).`)
      } else {
        setOk('Regra salva');
      }
      resetForm(); await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onEdit = (it: Item) => {
    setEditId(it.id);
    setCursoId(it.curso_id || "");
    setClasseId(it.classe_id || "");
    setValor(String(it.valor));
    setDia(it.dia_vencimento ? String(it.dia_vencimento) : "");
    setAtivo(it.ativo);
  };

  const onDelete = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    setError(null); setOk(null);
    try {
      const res = await fetch(`/api/financeiro/tabelas-mensalidade?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || 'Falha ao excluir');
      setOk('Excluída'); await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Tabelas de Mensalidade</h1>
        <button onClick={loadAll} className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50">Atualizar</button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      {ok && <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">{ok}</div>}

      {/* Filtros */}
      <div className="grid md:grid-cols-3 gap-4 bg-white p-4 border rounded">
        <div>
          <label className="block text-sm text-gray-700">Filtrar por Curso</label>
          <select value={fCurso} onChange={(e) => setFCurso(e.target.value)} className="mt-1 block w-full rounded border-gray-300">
            <option value="">Todos</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Filtrar por Classe</label>
          <select value={fClasse} onChange={(e) => setFClasse(e.target.value)} className="mt-1 block w-full rounded border-gray-300">
            <option value="">Todas</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="bg-white p-4 border rounded space-y-4">
        <h2 className="text-lg font-medium">Nova regra / Atualizar existente</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-700">Curso (opcional)</label>
            <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="mt-1 block w-full rounded border-gray-300">
              <option value="">—</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Classe (opcional)</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)} className="mt-1 block w-full rounded border-gray-300">
              <option value="">—</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Valor (KZ)</label>
            <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 block w-full rounded border-gray-300" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Dia vencimento (1–31, opcional)</label>
            <input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 block w-full rounded border-gray-300" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={applyExisting} onChange={(e) => setApplyExisting(e.target.checked)} />
            Aplicar aos alunos existentes (mensalidades pendentes)
          </label>
          {applyExisting && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4" checked={applyPast} onChange={(e) => setApplyPast(e.target.checked)} />
              Incluir parcelas passadas pendentes (não pagas)
            </label>
          )}
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Salvar</button>
          <button type="button" onClick={resetForm} className="px-4 py-2 border rounded bg-white hover:bg-gray-50">Limpar</button>
        </div>
        {editId && <p className="text-xs text-gray-500">Editando: {editId}</p>}
      </form>

      {/* Lista */}
      <div className="bg-white border rounded overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Curso</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Classe</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Valor</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Dia</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ativo</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={6}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={6}>Nenhuma regra</td></tr>
            ) : (
              filtered.map(it => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{refName(cursos, it.curso_id) || '—'}</td>
                  <td className="px-4 py-2 text-sm">{refName(classes, it.classe_id) || '—'}</td>
                  <td className="px-4 py-2 text-sm">{formatMoney(it.valor)}</td>
                  <td className="px-4 py-2 text-sm">{it.dia_vencimento ?? '—'}</td>
                  <td className="px-4 py-2 text-sm">{it.ativo ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => onEdit(it)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Editar</button>
                      <button onClick={() => onDelete(it.id)} className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function refName(list: Ref[], id: string | null) {
  if (!id) return null;
  return list.find(x => x.id === id)?.nome || null;
}

function formatMoney(v: number) {
  try { return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v); } catch { return String(v); }
}
