"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

type Student = { id: string; label: string };

type Props = {
  open: boolean;
  escolaId: string;
  aluno: Student;
  actionId?: BalcaoActionId;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BalcaoWorkspace({
  open,
  escolaId,
  aluno,
  actionId = "desk",
  onClose,
  onSuccess,
}: Props) {
  // Selecionar "Nova matrícula" muda a operação, nunca o aluno em atendimento.
  const [selectedStudent, setSelectedStudent] = useState<Student>(aluno);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(actionId);
  const completedEnrollmentRef = useRef(false);
  const studentRequestRef = useRef(0);

  useEffect(() => {
    setSelectedStudent(aluno);
    setActiveAction(actionId);
    completedEnrollmentRef.current = false;
  }, [actionId, aluno.id, aluno.label]);

  useEffect(() => () => {
    studentRequestRef.current += 1;
  }, []);

  const confirmLeavingEnrollment = useCallback(() => (
    activeAction !== "enrollment" || completedEnrollmentRef.current ||
    window.confirm("Sair da nova matrícula? Alterações ainda não guardadas poderão perder-se. O aluno anterior continuará selecionado.")
  ), [activeAction]);

  const handleActionChange = useCallback((next: BalcaoActionId) => {
    if (next === activeAction || !confirmLeavingEnrollment()) return;
    if (next === "enrollment") completedEnrollmentRef.current = false;
    setActiveAction(next);
  }, [activeAction, confirmLeavingEnrollment]);

  const handleClose = useCallback(() => {
    if (!confirmLeavingEnrollment()) return;
    onClose();
  }, [confirmLeavingEnrollment, onClose]);

  const handleSuccess = useCallback((newAlunoId?: string) => {
    if (activeAction === "enrollment" && newAlunoId) {
      completedEnrollmentRef.current = true;
      // Só depois do backend confirmar a matrícula mudamos para o aluno criado.
      setSelectedStudent({ id: newAlunoId, label: "Aluno matriculado" });
      setActiveAction("desk");
      const version = ++studentRequestRef.current;
      void fetch(`/api/secretaria/alunos/${encodeURIComponent(newAlunoId)}`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (version !== studentRequestRef.current || !payload?.ok || payload.item?.id !== newAlunoId) return;
          const label = payload.item.nome || payload.item.nome_completo;
          if (typeof label === "string" && label.trim()) {
            setSelectedStudent({ id: newAlunoId, label: label.trim() });
          }
        })
        .catch(() => {
          // O nome temporário é seguro; os restantes dados são carregados pelos painéis.
        });
    }
    onSuccess?.();
  }, [activeAction, onSuccess]);

  if (!open) return null;

  return (
    <CommandCenterShell
      variant="modal"
      student={selectedStudent}
      activeAction={activeAction}
      onActionChange={handleActionChange}
      onClose={handleClose}
    >
      <CommandCenterPanel
        key={selectedStudent.id}
        escolaId={escolaId}
        inModal
        alunoId={activeAction === "enrollment" ? null : selectedStudent.id}
        actionId={activeAction}
        onActionChange={handleActionChange}
        onSuccess={handleSuccess}
      />
    </CommandCenterShell>
  );
}

export default BalcaoWorkspace;
