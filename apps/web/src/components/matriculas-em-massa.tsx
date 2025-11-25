"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  School,
  Users,
  CheckCircle2,
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

  // ---------------------------------------------------
  // Helpers
  // ---------------------------------------------------

  // Key estável por grupo (curso + classe + turno + turma + ano)
  const makeGrupoKey = (g: GrupoMatricula) =>
    [
      g.curso_codigo || "sem-curso",
      g.classe_numero || "sem-classe",
      g.turno_codigo || "sem-turno",
      g.turma_letra || "sem-turma",
      g.ano_letivo || "sem-ano",
    ].join("|");

  const formatClasseLabel = (classe_numero?: string | number | null) => {
    if (!classe_numero) return "Classe não informada";
    const num = Number(classe_numero);
    if (!Number.isFinite(num)) return String(classe_numero);
    return `${num}ª classe`;
  };

  const formatTurnoLabel = (turno_codigo?: string | null) => {
    if (!turno_codigo) return "Turno não informado";
    const t = turno_codigo.toUpperCase().trim();
    if (t === "M") return "Manhã";
    if (t === "T") return "Tarde";
    if (t === "N") return "Noite";
    return turno_codigo;
  };

  const turmasPorAno = useMemo(() => {
    const map = new Map<string, Turma[]>();
    for (const turma of turmas) {
      const ano = (turma as any).ano_letivo ?? (turma as any).anoLetivo;
      const key = ano ? String(ano) : "sem-ano";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(turma);
    }
    return map;
  }, [turmas]);

  const getTurmasParaGrupo = (grupo: GrupoMatricula) => {
    const anoKey = grupo.ano_letivo ? String(grupo.ano_letivo) : "sem-ano";
    const lista = turmasPorAno.get(anoKey) ?? turmas;

    // Se quiser filtrar ainda mais por classe/turno, dá pra refinar aqui
    return lista;
  };

  // ---------------------------------------------------
  // Carregar grupos e turmas
  // ---------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      setLoading(true);
      setError(null);
      try {
        // 1) grupos pré-matrícula
        const gruposRes = await fetch(`/api/migracao/${importId}/pre-matriculas`);
        const gruposJson = await gruposRes.json();
        if (!gruposRes.ok) {
          throw new Error(gruposJson.error || "Erro ao carregar grupos de pré-matrícula");
        }

        // 2) turmas da escola
        const turmasRes = await fetch(`/api/escolas/${escolaId}/turmas`);
        const turmasJson = await turmasRes.json();
        if (!turmasRes.ok) {
          throw new Error(turmasJson.error || "Erro ao carregar turmas da escola");
        }

        if (cancelled) return;

        setGrupos(gruposJson.grupos ?? []);
        setTurmas(turmasJson.turmas ?? []);
      } catch (err) {
        console.error("[MatriculasEmMassa] erro ao carregar:", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro inesperado ao carregar dados de matrícula em massa.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    carregar();

    return () => {
      cancelled = true;
    };
  }, [importId, escolaId]);

  // ---------------------------------------------------
  // Ação: matricular um grupo
  // ---------------------------------------------------

  const matricularGrupo = async (grupo: GrupoMatricula, turmaId: string) => {
    const key = makeGrupoKey(grupo);
    setMatriculandoKey(key);
    setError(null);

    try {
      const payload: MatriculaMassaPayload = {
        import_id: grupo.import_id,
        escola_id: grupo.escola_id,
        curso_codigo: grupo.curso_codigo!,
        classe_numero: grupo.classe_numero!,
        turno_codigo: grupo.turno_codigo!,
        turma_letra: grupo.turma_letra!,
        ano_letivo: grupo.ano_letivo!,
        turma_id: turmaId,
      };

      const res = await fetch("/api/matriculas/massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Falha ao matricular grupo");
      }

      const successCount = json.success_count ?? 0;
      const errorCount = json.error_count ?? 0;

      // Remove grupo da lista
      setGrupos((prev) =>
        prev.filter((g) => makeGrupoKey(g) !== makeGrupoKey(grupo)),
      );

      onMatriculaConcluida?.();

      if (errorCount > 0) {
        alert(
          `✅ ${successCount} alunos matriculados. ⚠️ ${errorCount} alunos com erro (verificar logs de importação).`,
        );
      } else {
        alert(`✅ ${successCount} alunos matriculados com sucesso!`);
      }
    } catch (err) {
      console.error("[MatriculasEmMassa] erro ao matricular grupo:", err);
      setError(
        err instanceof Error ? err.message : "Erro inesperado ao matricular grupo.",
      );
    } finally {
      setMatriculandoKey(null);
    }
  };

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando grupos de alunos para matrícula em massa...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-4 text-sm">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Erro ao carregar dados de matrícula em massa.</span>
        </div>
        <p className="text-xs text-red-700/80">{error}</p>
      </div>
    );
  }

  if (!grupos.length) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-600">
        <p className="font-medium">Nenhum grupo encontrado para matrícula em massa.</p>
        <p className="text-xs text-slate-500">
          Verifique se o CSV contém as colunas de matrícula (curso, classe, turno, turma,
          ano letivo) e se os alunos já foram importados com sucesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner de contexto */}
      <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
          <School className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-blue-900">
              Matrículas em massa a partir da importação
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
              {grupos.length} grupo{grupos.length > 1 ? "s" : ""} de alunos
            </span>
          </div>
          <p className="text-xs text-blue-800">
            Cada grupo abaixo representa um conjunto de alunos com o mesmo curso, classe,
            turno, turma e ano letivo. Selecione a turma do sistema para criar as
            matrículas de todos de uma vez.
          </p>
        </div>
      </div>

      {/* Lista de grupos */}
      <div className="space-y-4">
        {grupos.map((grupo) => {
          const key = makeGrupoKey(grupo);
          const turmasDisponiveis = getTurmasParaGrupo(grupo);
          const isProcessing = matriculandoKey === key;

          return (
            <div
              key={key}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Info do grupo */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {formatClasseLabel(grupo.classe_numero)}{" "}
                      {grupo.turma_letra && (
                        <span className="text-slate-600">
                          — Turma {grupo.turma_letra}
                        </span>
                      )}
                    </h4>
                    {grupo.ano_letivo && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Ano letivo: {grupo.ano_letivo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {grupo.curso_codigo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Curso: {grupo.curso_codigo}
                      </span>
                    )}
                    {grupo.turno_codigo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Turno: {formatTurnoLabel(grupo.turno_codigo)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      <Users className="h-3 w-3" />
                      {grupo.count} aluno{grupo.count > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Ação: selecionar turma e matricular */}
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Selecionar turma alvo
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-56"
                      defaultValue=""
                      disabled={isProcessing || !turmasDisponiveis.length}
                      onChange={(e) => {
                        const turmaId = e.target.value;
                        if (turmaId) {
                          matricularGrupo(grupo, turmaId);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">
                        {turmasDisponiveis.length
                          ? "Escolha uma turma..."
                          : "Nenhuma turma disponível para este ano"}
                      </option>
                      {turmasDisponiveis.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.classe?.nome
                            ? `${turma.classe.nome} — ${turma.nome}`
                            : turma.nome}
                        </option>
                      ))}
                    </select>
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Matriculando...
                      </span>
                    )}
                    {!isProcessing && (
                      <span className="hidden text-[11px] text-slate-400 sm:inline">
                        Ao escolher a turma, as matrículas serão criadas para todo o grupo.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de amostra de alunos */}
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="mb-1 text-[11px] font-medium text-slate-500">
                  Amostra de alunos deste grupo
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-slate-700">
                  {grupo.alunos.slice(0, 10).map((aluno) => (
                    <div
                      key={aluno.id}
                      className="flex items-center justify-between border-b border-slate-100 py-1 last:border-b-0"
                    >
                      <span>{aluno.nome || "Nome não informado"}</span>
                      {!aluno.aluno_id && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Aluno ainda não criado
                        </span>
                      )}
                    </div>
                  ))}
                  {grupo.alunos.length > 10 && (
                    <div className="py-1 text-center text-[11px] text-slate-500">
                      ... e mais {grupo.alunos.length - 10} alunos
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé: status geral */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>
            Ao concluir todos os grupos, os alunos importados estarão com matrícula ativa nas
            respetivas turmas.
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Importação: <code className="rounded bg-slate-200 px-1.5 py-0.5">{importId}</code>
        </span>
      </div>
    </div>
  );
}
