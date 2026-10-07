"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import AcademicYearSelector from "@/components/academic/AcademicYearSelector";
import BalcaoAtendimento, { type AlunoDossier } from "@/components/secretaria/BalcaoAtendimento";
import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import { useCommandCenterStudent } from "@/components/secretaria/command-center/useCommandCenterStudent";
import { ResumoCaixaSecretaria } from "@/components/secretaria/ResumoCaixaSecretaria";
import {
  BALCAO_ACTION_REGISTRY,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";

function parseAction(value: string | null): BalcaoActionId {
  return value && value in BALCAO_ACTION_REGISTRY
    ? value as BalcaoActionId
    : "desk";
}

export default function BalcaoPageClient({
  escolaId,
  escolaParam,
}: {
  escolaId: string;
  escolaParam: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryAlunoId = searchParams?.get("alunoId") ?? null;
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM) ?? null;
  const queryAction = parseAction(searchParams?.get("action") ?? null);
  const returnToParam = searchParams?.get("returnTo") ?? null;
  const returnTo = returnToParam?.startsWith("/") && !returnToParam.startsWith("//")
    ? returnToParam
    : null;

  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(queryAlunoId);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(queryAction);
  const [caixaRefreshKey, setCaixaRefreshKey] = useState(0);
  const {
    student: commandCenterStudent,
    setStudent: setCommandCenterStudent,
    subtitle: commandCenterSubtitle,
  } = useCommandCenterStudent(selectedAlunoId, academicYearId);

  useEffect(() => {
    setSelectedAlunoId(queryAlunoId);
  }, [queryAlunoId]);

  useEffect(() => {
    setActiveAction(queryAction);
  }, [queryAction]);

  const aoConcluirPagamento = useCallback(
    () => setCaixaRefreshKey((current) => current + 1),
    [],
  );

  const syncLocation = useCallback((params: {
    alunoId?: string | null;
    actionId?: BalcaoActionId;
  }) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    const nextAlunoId = params.alunoId === undefined ? selectedAlunoId : params.alunoId;
    const nextAction = params.actionId ?? activeAction;

    if (nextAlunoId) next.set("alunoId", nextAlunoId);
    else next.delete("alunoId");

    if (nextAction === "desk") next.delete("action");
    else next.set("action", nextAction);

    const query = next.toString();
    const targetPath = pathname || "/secretaria/balcao";
    router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false });
  }, [activeAction, pathname, router, searchParams, selectedAlunoId]);

  const handleCommandCenterSuccess = useCallback((newAlunoId?: string) => {
    setCaixaRefreshKey((current) => current + 1);
    if (!newAlunoId) return;

    setSelectedAlunoId(newAlunoId);
    syncLocation({ alunoId: newAlunoId, actionId: "enrollment" });
  }, [syncLocation]);

  const handleActionChange = useCallback((actionId: BalcaoActionId) => {
    setActiveAction(actionId);

    // Matrícula é uma nova operação, não uma ação sobre o aluno atualmente
    // selecionado. Limpar o contexto evita que o cabeçalho sugira que estamos
    // a matricular novamente aquele mesmo aluno.
    if (actionId === "enrollment") {
      setSelectedAlunoId(null);
      setCommandCenterStudent(null);
      syncLocation({ alunoId: null, actionId });
      return;
    }

    syncLocation({ actionId });
  }, [setCommandCenterStudent, syncLocation]);

  const handleAlunoSelected = useCallback((aluno: AlunoDossier | null) => {
    const nextAlunoId = aluno?.id ?? null;
    setSelectedAlunoId(nextAlunoId);
    if (!aluno) {
      setCommandCenterStudent(null);
      setActiveAction("desk");
      syncLocation({ alunoId: null, actionId: "desk" });
      return;
    }

    setCommandCenterStudent({
      id: aluno.id,
      label: aluno.nome,
      numeroProcesso: aluno.numero_processo,
      classe: aluno.classe ?? null,
      turma: aluno.turma_codigo ?? null,
      turmaId: aluno.turma_id ?? null,
    });
    syncLocation({ alunoId: nextAlunoId });
  }, [setCommandCenterStudent, syncLocation]);

  return (
    <CommandCenterShell
      variant="page"
      student={commandCenterStudent ? {
        id: commandCenterStudent.id,
        label: commandCenterStudent.label,
        subtitle: commandCenterSubtitle,
      } : null}
      activeAction={activeAction}
      onActionChange={handleActionChange}
      leading={
        <Link
          href={`/escola/${escolaParam}/secretaria`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Voltar à Secretaria"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      }
      trailing={<AcademicYearSelector escolaId={escolaId} />}
    >
      <ResumoCaixaSecretaria escolaId={escolaId} refreshKey={caixaRefreshKey} />

      <section className="mt-4 min-w-0 pb-2">
        {selectedAlunoId || activeAction === "enrollment" ? (
          <CommandCenterPanel
            escolaId={escolaId}
            alunoId={selectedAlunoId}
            turmaId={commandCenterStudent?.turmaId ?? null}
            turmaLabel={commandCenterStudent?.turma ?? null}
            actionId={activeAction}
            returnTo={returnTo}
            onActionChange={handleActionChange}
            onAlunoSelected={handleAlunoSelected}
            onSuccess={handleCommandCenterSuccess}
          />
        ) : (
          <BalcaoAtendimento
            escolaId={escolaId}
            selectedAlunoId={null}
            showSearch
            embedded
            view="overview"
            onNavigateAction={handleActionChange}
            onAlunoSelected={handleAlunoSelected}
            onPagamentoConcluido={aoConcluirPagamento}
          />
        )}
      </section>
    </CommandCenterShell>
  );
}
