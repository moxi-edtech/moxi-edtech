"use client";

import { useEffect, useMemo, useState } from "react";

export type CommandCenterStudentContext = {
  id: string;
  label: string;
  numeroProcesso?: string | null;
  classe?: string | null;
  turma?: string | null;
  turmaId?: string | null;
};

export function useCommandCenterStudent(
  alunoId: string | null,
  academicYearId: string | null,
  fallbackLabel?: string | null,
) {
  const [student, setStudent] = useState<CommandCenterStudentContext | null>(
    alunoId ? { id: alunoId, label: fallbackLabel || "Aluno" } : null,
  );
  const [loading, setLoading] = useState(Boolean(alunoId));

  useEffect(() => {
    let active = true;

    if (!alunoId) {
      setStudent(null);
      setLoading(false);
      return;
    }

    setStudent((current) =>
      current?.id === alunoId
        ? {
            ...current,
            classe: null,
            turma: null,
            turmaId: null,
          }
        : { id: alunoId, label: fallbackLabel || "Aluno" },
    );
    setLoading(true);

    const params = new URLSearchParams();
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    const query = params.toString();

    fetch(`/api/secretaria/alunos/${alunoId}${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || !payload?.ok || !payload?.item) return;
        const item = payload.item;
        setStudent({
          id: alunoId,
          label: item.nome || item.nome_completo || fallbackLabel || "Aluno",
          numeroProcesso: item.numero_processo || item.processo || null,
          classe: item.classe_nome || item.classe || null,
          turma: item.turma_nome || item.turma_codigo || item.turma || null,
          turmaId: item.turma_id || null,
        });
      })
      .catch(() => {
        // O fallback já permite continuar o atendimento. O painel da ação
        // mantém a sua própria estratégia de erro para dados específicos.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [academicYearId, alunoId, fallbackLabel]);

  const subtitle = useMemo(() => {
    if (!student) return null;
    return [
      student.numeroProcesso ? `Proc. ${student.numeroProcesso}` : null,
      student.classe,
      student.turma ? `Turma ${student.turma}` : null,
    ].filter(Boolean).join(" · ");
  }, [student]);

  return {
    student,
    setStudent,
    subtitle,
    loading,
  };
}
