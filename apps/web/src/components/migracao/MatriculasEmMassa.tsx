"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  School,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import type { GrupoMatricula, MatriculaMassaPayload } from "~types/matricula";
import type { Turma } from "~types/turma";

interface MatriculasEmMassaProps {
  importId: string;
  escolaId: string;
  onMatriculaConcluida?: () => void;
}

export function MatriculasEmMassa({
  importId,
  escolaId,
  onMatriculaConcluida,
}: MatriculasEmMassaProps) {
  const [grupos, setGrupos] = useState<GrupoMatricula[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [matriculandoKey, setMatriculandoKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // key única por grupo
  const grupoKey = (g: GrupoMatricula) =>
    [
      g.curso_codigo ?? "",
      g.classe_numero ?? "",
      g.turno_codigo ?? "",
      g.turma_letra ?? "",
      g.ano_letivo ?? "",
    ].join("|");

  // labels amigáveis
  const turnoLabel = (codigo?: string | null) => {
    if (!codigo) return "Sem turno";
    const c = codigo.toUpperCase();
    if (c === "M") return "Manhã";
    if (c === "T") return "Tarde";
    if (c === "N") return "Noite";
    return c;
  };

  const classeLabel = (classe?: number | string | null) => {
    if (!classe) return "Classe não definida";
    const num = Number(classe);
    if (!Number.isNaN(num)) {
      return `${num}ª classe`;
    }
    return String(classe);
  };

  // Carregar grupos + turmas
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        const [gruposRes, turmasRes] = await Promise.all([
          fetch(`/api/migracao/${importId}/pre-matriculas`),
          fetch(`/api/escolas/${escolaId}/turmas`),
        ]);

        const gruposJson = await gruposRes.json();
        const turmasJson = await turmasRes.json();

        if (!gruposRes.ok) {
          throw new Error(gruposJson.error || "Erro ao carregar grupos");
        }
        if (!turmasRes.ok) {
          throw new Error(turmasJson.error || "Erro ao carregar turmas");
        }

        setGrupos(gruposJson.grupos ?? []);
        setTurmas(turmasJson.turmas ?? []);

        if ((gruposJson.grupos ?? []).length === 0) {
          setInfo(
            "Nenhum grupo de pré-matrícula encontrado para este ficheiro. Verifique se o CSV tem Curso / Classe / Turno / Turma / Ano letivo."
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar dados de pré-matrícula."
        );
      } finally {
        setLoading(false);
      }
    }

    if (importId && escolaId) {
      load();
    }
  }, [importId, escolaId]);

  // Filtrar turmas compatíveis com o grupo
  const turmasPorGrupo = useMemo(() => {
    const map = new Map<string, Turma[]>();

    for (const g of grupos) {
      const key = grupoKey(g);

      const list = (turmas ?? []).filter((t) => {
        // ano letivo
        if (g.ano_letivo && t.ano_letivo && t.ano_letivo !== g.ano_letivo) {
          return false;
        }

        // classe (por número)
        if (g.classe_numero && t.classe?.numero) {
          if (Number(t.classe.numero) !== Number(g.classe_numero)) return false;
        }

        // turno: se a escola preencheu turno/codigo na turma
        if (g.turno_codigo && t.turno?.codigo) {
          if (t.turno.codigo.toUpperCase() !== g.turno_codigo.toUpperCase()) {
            return false;
          }
        }

        // curso: se houver vínculo curso_codigo na turma
        if (g.curso_codigo && t.curso?.codigo) {
          if (t.curso.codigo.toUpperCase() !== g.curso_codigo.toUpperCase()) {
            return false;
          }
        }

        return true;
      });

      map.set(key, list);
    }

    return map;
  }, [grupos, turmas]);

  const handleMatricularGrupo = async (grupo: GrupoMatricula, turmaId: string) => {
    setError(null);
    setInfo(null);
    setMatriculandoKey(grupoKey(grupo));

    try {
      const payload = {
        import_id: grupo.import_id,
        escola_id: grupo.escola_id,
        turma_id: turmaId,
      };

      const res = await fetch("/api/matriculas/massa/por-turma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Falha ao matricular grupo");
      }

      // remover grupo matriculado da lista
      setGrupos((prev) =>
        prev.filter((g) => grupoKey(g) !== grupoKey(grupo))
      );

      if (onMatriculaConcluida) onMatriculaConcluida();

      const ok = json.success_count ?? json[0]?.success_count ?? 0;
      const errCount = json.error_count ?? json[0]?.error_count ?? 0;

      setInfo(
        `✅ ${ok} aluno(s) matriculado(s) com sucesso. ${
          errCount ? ` ${errCount} registro(s) com erro.` : ""
        }`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao matricular este grupo."
      );
    } finally {
      setMatriculandoKey(null);
    }
  };

  if (!importId || !escolaId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Importação ou escola não identificadas. Volte ao início do wizard.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar grupos de pré-matrícula...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Erro ao carregar matrículas em massa</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header explicativo */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 flex items-start gap-3 shadow-sm">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <School className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Matrículas em massa por grupo
          </h3>
          <p className="text-xs text-slate-500">
            Usamos as colunas <strong>Curso</strong>, <strong>Classe</strong>,{" "}
            <strong>Turno</strong>, <strong>Turma</strong> e{" "}
            <strong>Ano letivo</strong> do ficheiro para agrupar alunos. Depois
            você só escolhe a turma real em que cada grupo será matriculado.
          </p>
        </div>
      </div>

      {info && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {info}
        </div>
      )}

      {grupos.length === 0 && !info && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Não há mais grupos pendentes para matrícula em massa.
        </div>
      )}

      {grupos.map((grupo) => {
        const key = grupoKey(grupo);
        const turmasCompat = turmasPorGrupo.get(key) ?? [];

        const hasTurmas = turmasCompat.length > 0;
        const disabled = matriculandoKey === key;

        return (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                    <Users className="h-3 w-3" />
                    {grupo.count} aluno(s)
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {grupo.curso_codigo ?? "Curso indefinido"} ·{" "}
                  {classeLabel(grupo.classe_numero)} · Turno{" "}
                  {turnoLabel(grupo.turno_codigo)} · Turma{" "}
                  {grupo.turma_letra || "?"} · {grupo.ano_letivo}
                </h4>
                <p className="text-xs text-slate-500">
                  Os alunos deste grupo vieram do mesmo combo de Curso/Classe/Turno/Turma/Ano
                  no ficheiro.
                </p>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-[220px]">
                <label className="text-[11px] font-medium text-slate-500">
                  Selecionar turma real
                </label>
                <div className="flex items-center gap-2">
                  <select
                    className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!hasTurmas || disabled}
                    onChange={(e) => {
                      const turmaId = e.target.value;
                      if (!turmaId) return;
                      handleMatricularGrupo(grupo, turmaId);
                      // limpa seleção (opcional)
                      e.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="">
                      {hasTurmas
                        ? "Escolha uma turma..."
                        : "Nenhuma turma compatível encontrada"}
                    </option>
                    {turmasCompat.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.curso?.nome
                          ? `${t.curso.nome} · `
                          : ""}
                        {t.classe?.nome
                          ? `${t.classe.nome} · `
                          : ""}
                        {t.nome}{" "}
                        {t.turno?.nome ? `· ${t.turno.nome}` : ""}
                      </option>
                    ))}
                  </select>

                  {disabled ? (
                    <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Matriculando...
                    </div>
                  ) : hasTurmas ? (
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                {!hasTurmas && (
                  <p className="text-[11px] text-amber-700">
                    Crie / ajuste as turmas desta escola (curso, classe, turno,
                    ano letivo) para habilitar a matrícula em massa deste grupo.
                  </p>
                )}
              </div>
            </div>

            {/* Lista de alunos (preview) */}
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60">
              {grupo.alunos.slice(0, 10).map((aluno) => (
                <div
                  key={aluno.id}
                  className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 border-slate-100 text-xs"
                >
                  <span className="text-slate-800">
                    {aluno.nome || "Nome não informado"}
                  </span>
                  {!aluno.profile_id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Sem profile
                    </span>
                  )}
                </div>
              ))}
              {grupo.alunos.length > 10 && (
                <div className="px-3 py-1.5 text-[11px] text-slate-500 text-center border-t border-slate-100 bg-white/60">
                  ... e mais {grupo.alunos.length - 10} aluno(s)
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Hint final */}
      {grupos.length > 0 && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Dica: você pode repetir o processo quantas vezes quiser para o mesmo
          ficheiro de importação. Matrículas existentes serão atualizadas.
        </p>
      )}
    </div>
  );
}
