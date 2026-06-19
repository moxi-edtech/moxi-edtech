"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, PlusCircle, Save } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

type ClasseOption = {
  id: string;
  nome: string;
  numero: number | null;
};

type SavedNota = {
  id?: string;
  disciplina_id: string;
  disciplina_nome: string;
  ordem: number | null;
  nota_final: number | null;
};

type SavedRecord = {
  id: string;
  classe_id: string;
  classe_nome: string;
  curso_nome: string | null;
  ano_letivo: number;
  created_at: string;
  updated_at: string;
  notas: SavedNota[];
};

type EditorPayload = {
  classe_id: string;
  classe_nome: string;
  ano_letivo: number;
  disciplinas: SavedNota[];
};

async function fetchHistoricoTransitadoSummary(alunoId: string) {
  const res = await fetch(`/api/secretaria/alunos/${alunoId}/historico-transitado`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? "Falha ao carregar histórico transitado.");
  }

  return {
    classes: Array.isArray(json.classes) ? (json.classes as ClasseOption[]) : [],
    records: Array.isArray(json.records) ? (json.records as SavedRecord[]) : [],
  };
}

async function fetchHistoricoTransitadoEditor(alunoId: string, classeId: string, anoLetivo: number) {
  const params = new URLSearchParams({
    classe_id: classeId,
    ano_letivo: String(anoLetivo),
  });

  const res = await fetch(`/api/secretaria/alunos/${alunoId}/historico-transitado?${params.toString()}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? "Falha ao montar a grelha do histórico.");
  }

  return (json.editor ?? null) as EditorPayload | null;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DossierHistoricoTransitadoSection({
  alunoId,
  canEdit = true,
}: {
  alunoId: string;
  canEdit?: boolean;
}) {
  const { error, success } = useToast();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [classes, setClasses] = useState<ClasseOption[]>([]);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [classeId, setClasseId] = useState("");
  const [classeNome, setClasseNome] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(String(new Date().getFullYear() - 1));
  const [disciplinas, setDisciplinas] = useState<SavedNota[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setFeedback(null);
      try {
        const summary = await fetchHistoricoTransitadoSummary(alunoId);
        if (!active) return;
        setClasses(summary.classes);
        setRecords(summary.records);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Erro desconhecido.";
        setFeedback(message);
        setClasses([]);
        setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [alunoId]);

  useEffect(() => {
    if (!editorOpen) return;
    const nextAnoLetivo = Number.parseInt(anoLetivo, 10);
    if (!classeId || !Number.isFinite(nextAnoLetivo) || nextAnoLetivo < 1900 || nextAnoLetivo > 2100) {
      setClasseNome("");
      setDisciplinas([]);
      return;
    }

    let active = true;

    async function run() {
      setGridLoading(true);
      setFeedback(null);
      try {
        const editor = await fetchHistoricoTransitadoEditor(alunoId, classeId, nextAnoLetivo);
        if (!active) return;
        if (!editor) {
          setClasseNome("");
          setDisciplinas([]);
          return;
        }

        setClasseNome(editor.classe_nome);
        setDisciplinas(Array.isArray(editor.disciplinas) ? editor.disciplinas : []);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Erro desconhecido.";
        setFeedback(message);
        setClasseNome("");
        setDisciplinas([]);
      } finally {
        if (active) setGridLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [alunoId, anoLetivo, classeId, editorOpen]);

  const missingIndex = disciplinas.findIndex((disciplina) => disciplina.nota_final == null);
  const canSave =
    editorOpen &&
    !saving &&
    !gridLoading &&
    Boolean(classeId) &&
    disciplinas.length > 0 &&
    missingIndex === -1;

  async function handleSave() {
    const parsedAnoLetivo = Number.parseInt(anoLetivo, 10);
    if (!classeId || !Number.isFinite(parsedAnoLetivo)) {
      error("Dados incompletos", "Selecione a classe e o ano civil antes de salvar.");
      return;
    }

    if (missingIndex !== -1) {
      error("Notas em falta", "Preencha todas as disciplinas obrigatórias antes de salvar.");
      inputRefs.current[missingIndex]?.focus();
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/secretaria/alunos/${alunoId}/historico-transitado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classe_id: classeId,
          ano_letivo: parsedAnoLetivo,
          notas: disciplinas.map((disciplina) => ({
            disciplina_id: disciplina.disciplina_id,
            disciplina_nome: disciplina.disciplina_nome,
            ordem: disciplina.ordem,
            nota_final: disciplina.nota_final,
          })),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Falha ao salvar histórico transitado.");
      }

      success("Histórico salvo", "As notas transitadas ficaram guardadas no perfil do aluno.");
      const summary = await fetchHistoricoTransitadoSummary(alunoId);
      setClasses(summary.classes);
      setRecords(summary.records);

      const editor = await fetchHistoricoTransitadoEditor(alunoId, classeId, parsedAnoLetivo);
      setClasseNome(editor?.classe_nome ?? "");
      setDisciplinas(Array.isArray(editor?.disciplinas) ? editor.disciplinas : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setFeedback(message);
      error("Falha ao salvar", message);
    } finally {
      setSaving(false);
    }
  }

  function handleStartBlank() {
    setEditorOpen(true);
    setClasseNome("");
    setDisciplinas([]);
    if (!anoLetivo) {
      setAnoLetivo(String(new Date().getFullYear() - 1));
    }
  }

  function handleEditRecord(record: SavedRecord) {
    setEditorOpen(true);
    setClasseId(record.classe_id);
    setAnoLetivo(String(record.ano_letivo));
  }

  function updateNota(index: number, value: string) {
    setDisciplinas((current) =>
      current.map((disciplina, currentIndex) => {
        if (currentIndex !== index) return disciplina;
        return {
          ...disciplina,
          nota_final: value.trim() === "" ? null : Number.parseFloat(value),
        };
      }),
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando histórico transitado...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Histórico transitado</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notas de anos anteriores lançadas manualmente</h3>
              {!canEdit ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Documento transitado e bloqueado
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {canEdit
                ? "Use esta grelha para preservar classes passadas sem poluir o motor de avaliações do ano corrente."
                : "Este histórico está visível apenas para consulta. A edição fica reservada à secretaria e ao admin."}
            </p>
          </div>

          {canEdit ? (
            <button
              type="button"
              onClick={handleStartBlank}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 px-3 py-2 text-xs font-semibold text-[#1F6B3B] transition hover:bg-[#1F6B3B]/10"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar ano passado
            </button>
          ) : null}
        </div>

        {feedback ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {feedback}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              <BookOpen className="mx-auto mb-2 h-5 w-5 text-slate-400" />
              Sem anos transitados para este aluno.
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {record.classe_nome} · {record.ano_letivo}
                  </p>
                  <p className="text-xs text-slate-500">
                    {record.notas.length} disciplinas · Atualizado em {formatTimestamp(record.updated_at)}
                  </p>
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleEditRecord(record)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#E3B23C] hover:text-[#E3B23C]"
                  >
                    Editar grelha
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {editorOpen && canEdit ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classe</span>
              <select
                value={classeId}
                onChange={(event) => setClasseId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#1F6B3B]"
              >
                <option value="">Selecione a classe</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ano civil</span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={anoLetivo}
                onChange={(event) => setAnoLetivo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#1F6B3B]"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setEditorOpen(false);
                setClasseId("");
                setClasseNome("");
                setDisciplinas([]);
                setFeedback(null);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Fechar editor
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modo DataGrid</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {classeNome ? `${classeNome} · ${anoLetivo}` : "Escolha a classe e o ano para gerar a grelha"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Digite a nota e use <strong>Enter</strong> para avançar verticalmente. Faixa aceite: 0 a 20 valores.
            </p>
          </div>

          <div className="mt-4">
            {gridLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                A montar a grelha de disciplinas...
              </div>
            ) : disciplinas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Nenhuma disciplina obrigatória encontrada para esta classe. Verifique o currículo publicado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Disciplina
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Nota final
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {disciplinas.map((disciplina, index) => (
                      <tr key={disciplina.disciplina_id}>
                        <td className="px-4 py-3 text-slate-700">{disciplina.disciplina_nome}</td>
                        <td className="px-4 py-2">
                          <input
                            ref={(node) => {
                              inputRefs.current[index] = node;
                            }}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={20}
                            step="0.1"
                            value={disciplina.nota_final ?? ""}
                            onChange={(event) => updateNota(index, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              inputRefs.current[index + 1]?.focus();
                              inputRefs.current[index + 1]?.select();
                            }}
                            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#1F6B3B]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {disciplinas.length > 0
                ? `${disciplinas.length} disciplina(s) obrigatória(s) carregada(s).`
                : "A grelha será montada a partir do currículo da classe selecionada."}
            </p>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#185830] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar histórico
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
