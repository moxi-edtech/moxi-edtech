"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const queryAlunoId = searchParams?.get("alunoId") ?? null;
  const queryAction = parseAction(searchParams?.get("action") ?? null);
  const returnToParam = searchParams?.get("returnTo") ?? null;
  const returnTo = returnToParam?.startsWith("/") && !returnToParam.startsWith("//")
    ? returnToParam
    : null;

  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(queryAlunoId);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(queryAction);
  const [caixaRefreshKey, setCaixaRefreshKey] = useState(0);
  const commandStudent = useCommandCenterStudent(selectedAlunoId);

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

  const handleAlunoSelected = useCallback((aluno: AlunoDossier | null) => {
    setSelectedAlunoId(aluno?.id ?? null);
    if (!aluno) {
      commandStudent.setStudent(null);
      setActiveAction("desk");
      return;
    }

    commandStudent.setStudent({
      id: aluno.id,
      label: aluno.nome,
      numeroProcesso: aluno.numero_processo,
      classe: aluno.classe ?? null,
      turma: aluno.turma_codigo ?? null,
    });
  }, [commandStudent]);

  return (
    <CommandCenterShell
      variant="page"
      student={commandStudent.student ? {
        id: commandStudent.student.id,
        label: commandStudent.student.label,
        subtitle: commandStudent.subtitle,
      } : null}
      activeAction={activeAction}
      onActionChange={setActiveAction}
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

      <section className="mt-4 min-h-[620px]">
        {selectedAlunoId ? (
          <CommandCenterPanel
            escolaId={escolaId}
            alunoId={selectedAlunoId}
            actionId={activeAction}
            returnTo={returnTo}
            onActionChange={setActiveAction}
            onAlunoSelected={handleAlunoSelected}
            onSuccess={aoConcluirPagamento}
          />
        ) : (
          <BalcaoAtendimento
            escolaId={escolaId}
            selectedAlunoId={null}
            showSearch
            embedded
            view="overview"
            onNavigateAction={setActiveAction}
            onAlunoSelected={handleAlunoSelected}
            onPagamentoConcluido={aoConcluirPagamento}
          />
        )}
      </section>
    </CommandCenterShell>
  );
}
