"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import AcademicYearSelector from "@/components/academic/AcademicYearSelector";
import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import { BalcaoActionBar } from "@/components/secretaria/BalcaoActionBar";
import BalcaoAtendimento, { type AlunoDossier, type BalcaoView } from "@/components/secretaria/BalcaoAtendimento";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
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

function actionToView(action: BalcaoActionId): BalcaoView {
  if (action === "payment") return "payment";
  if (action === "document") return "document";
  if (action === "reenrollment") return "reenrollment";
  return "overview";
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
  const [selectedAluno, setSelectedAluno] = useState<AlunoDossier | null>(null);
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(queryAction);
  const [caixaRefreshKey, setCaixaRefreshKey] = useState(0);

  useEffect(() => {
    setSelectedAlunoId(queryAlunoId);
    setSelectedAluno(null);
  }, [queryAlunoId]);

  useEffect(() => {
    setActiveAction(queryAction);
  }, [queryAction]);

  const aoConcluirPagamento = useCallback(
    () => setCaixaRefreshKey((current) => current + 1),
    [],
  );

  const handleAlunoSelected = useCallback((aluno: AlunoDossier | null) => {
    setSelectedAluno(aluno);
    setSelectedAlunoId(aluno?.id ?? null);
    if (!aluno) setActiveAction("desk");
  }, []);

  const activeDescription = BALCAO_ACTION_REGISTRY[activeAction].description;
  const studentSubtitle = useMemo(() => {
    if (!selectedAluno) return "Pesquise um aluno para iniciar um atendimento.";
    return [
      selectedAluno.numero_processo && `Proc. ${selectedAluno.numero_processo}`,
      selectedAluno.classe,
      selectedAluno.turma_codigo && `Turma ${selectedAluno.turma_codigo}`,
    ].filter(Boolean).join(" · ");
  }, [selectedAluno]);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/escola/${escolaParam}/secretaria`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Voltar à Secretaria"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  KLASSE Command Center
                </p>
              </div>
              <h1 className="truncate text-lg font-black text-slate-900">
                {selectedAluno?.nome || "Atendimento"}
              </h1>
              <p className="truncate text-xs text-slate-500">{studentSubtitle}</p>
            </div>
          </div>
          <AcademicYearSelector escolaId={escolaId} />
        </div>
      </header>

      <main className="mx-auto mt-5 w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <ResumoCaixaSecretaria escolaId={escolaId} refreshKey={caixaRefreshKey} />

        {selectedAlunoId ? (
          <div className="mt-4 border-b border-slate-200 pb-3">
            <BalcaoActionBar
              value={activeAction}
              onChange={setActiveAction}
              label="Atendimento"
            />
          </div>
        ) : null}

        <section className="mt-4 min-h-[620px]">
          {selectedAlunoId && activeAction === "profile" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <AlunoProfilePanel alunoId={selectedAlunoId} />
            </div>
          ) : selectedAlunoId && activeAction === "grade" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <PautaRapidaModal hideNavigation />
            </div>
          ) : (
            <BalcaoAtendimento
              escolaId={escolaId}
              selectedAlunoId={selectedAlunoId}
              showSearch={!selectedAlunoId}
              embedded
              view={actionToView(activeAction)}
              focusAction={BALCAO_ACTION_REGISTRY[activeAction].focusAction ?? null}
              returnTo={returnTo}
              onNavigateAction={setActiveAction}
              onAlunoSelected={handleAlunoSelected}
              onPagamentoConcluido={aoConcluirPagamento}
            />
          )}
        </section>

        {selectedAlunoId ? (
          <p className="mt-3 text-xs text-slate-400">{activeDescription}</p>
        ) : null}
      </main>
    </div>
  );
}
