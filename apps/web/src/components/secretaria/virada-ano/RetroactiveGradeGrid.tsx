"use client";

import { useEffect, useMemo, useState } from "react";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";

type Props = { anoLetivo: number; onAddRows: (rows: Record<string, unknown>[]) => void };
type Turma = { id: string; turma_nome?: string; nome?: string; ano_letivo?: number };
type Disciplina = { id: string; disciplina?: { id?: string; nome?: string } | null };
type GradePayload = { matricula_id: string; numero_processo: string | null; numero_chamada: number | null; nome: string; notas: Record<string, number | null> };
type Avaliacao = { id: string; nome: string; tipo: string; trimestre: number; nota_max: number | null };

export function RetroactiveGradeGrid({ anoLetivo, onAddRows }: Props) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [trimestre, setTrimestre] = useState("1");
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState("");
  const [students, setStudents] = useState<GradePayload[]>([]);
  const [editedRows, setEditedRows] = useState<StudentGradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTurmaId(""); setDisciplinaId(""); setStudents([]); setDisciplinas([]);
    fetch(`/api/secretaria/turmas-simples?ano=${anoLetivo}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setTurmas(j.items ?? [])).catch(() => setTurmas([]));
  }, [anoLetivo]);

  useEffect(() => {
    setDisciplinaId(""); setStudents([]);
    if (!turmaId) return;
    fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, { cache: "no-store" }).then((r) => r.json()).then((j) => setDisciplinas(j.items ?? [])).catch(() => setDisciplinas([]));
  }, [turmaId]);

  useEffect(() => {
    setStudents([]); setEditedRows([]); setAvaliacoes([]); setSelectedAvaliacao(""); setError(null);
    if (!turmaId || !disciplinaId) return;
    setLoading(true);
    const params = new URLSearchParams({ turma_id: turmaId, disciplina_id: disciplinaId, ano_letivo: String(anoLetivo), trimestre });
    fetch(`/api/secretaria/operacoes-academicas/virada/notas/grid?${params}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) throw new Error(j.error || "Falha ao carregar grelha");
      setAvaliacoes(j.avaliacoes ?? []); setSelectedAvaliacao(j.avaliacoes?.[0]?.id ?? ""); setStudents(j.alunos ?? []);
    }).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  }, [anoLetivo, turmaId, disciplinaId, trimestre]);

  const gridData = useMemo<StudentGradeRow[]>(() => students.map((student, index) => ({ id: student.matricula_id, numero: student.numero_chamada ?? index + 1, nome: student.nome, mac1: student.notas[selectedAvaliacao] ?? null, npp1: null, npt1: null, mt1: student.notas[selectedAvaliacao] ?? null, _status: "synced" })), [students, selectedAvaliacao]);

  const addRows = (rows: StudentGradeRow[]) => {
    if (!selectedAvaliacao) return;
    const byId = new Map(students.map((student) => [student.matricula_id, student]));
    const payload = rows.filter((row) => typeof row.mac1 === "number").map((row) => ({ matricula_id: row.id, numero_processo: byId.get(row.id)?.numero_processo ?? null, avaliacao_id: selectedAvaliacao, nota: row.mac1 }));
    if (payload.length > 0) onAddRows(payload);
  };

  return <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
    <div><h4 className="text-sm font-semibold text-slate-800">Lançamento retroativo em grelha</h4><p className="text-xs text-slate-500">Selecione a turma e disciplina do ano de origem. A alteração só entra no lote após validação.</p></div>
    <div className="grid gap-2 md:grid-cols-4">
      <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className="rounded border bg-white px-2 py-2 text-xs"><option value="">Turma de origem</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.turma_nome || t.nome}</option>)}</select>
      <select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} disabled={!turmaId} className="rounded border bg-white px-2 py-2 text-xs"><option value="">Disciplina</option>{disciplinas.map((d) => <option key={d.disciplina?.id || d.id} value={d.disciplina?.id || d.id}>{d.disciplina?.nome || d.id}</option>)}</select>
      <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="rounded border bg-white px-2 py-2 text-xs"><option value="1">Trimestre 1</option><option value="2">Trimestre 2</option><option value="3">Trimestre 3</option></select>
      <select value={selectedAvaliacao} onChange={(e) => setSelectedAvaliacao(e.target.value)} disabled={!avaliacoes.length} className="rounded border bg-white px-2 py-2 text-xs"><option value="">Avaliação</option>{avaliacoes.map((a) => <option key={a.id} value={a.id}>{a.nome || a.tipo}</option>)}</select>
    </div>
    {error && <p className="text-xs text-rose-600">{error}</p>}
    {loading ? <p className="text-xs text-slate-500">A carregar alunos e notas...</p> : gridData.length > 0 ? <><GradeEntryGrid key={`${turmaId}:${disciplinaId}:${selectedAvaliacao}`} initialData={gridData} title="Notas do ano de origem" subtitle={`${avaliacoes.find((a) => a.id === selectedAvaliacao)?.nome || "Avaliação"} · ${anoLetivo}`} onDataChange={setEditedRows} showIsento={false} /><button type="button" onClick={() => addRows(editedRows.length > 0 ? editedRows : gridData)} className="rounded bg-klasse-green px-3 py-2 text-xs font-semibold text-white">Adicionar notas editadas ao lote</button></> : disciplinaId ? <p className="text-xs text-slate-500">Nenhum aluno ou avaliação encontrada para esta seleção.</p> : null}
  </section>;
}
