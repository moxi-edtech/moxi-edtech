"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { toast } from "sonner";
import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import {
  type CurriculumKey,
  type CurriculumCategory,
} from "@/lib/onboarding";
import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
  type SelectedBlueprint,
} from "./academicSetupTypes";

type Props = {
  escolaId: string;
};

export default function AcademicSetupWizard({ escolaId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // STEP 1 – identidade & sessão
  const [schoolDisplayName, setSchoolDisplayName] = useState<string>("Colégio Horizonte");
  const [regime, setRegime] = useState<"trimestral" | "semestral" | "bimestral">("trimestral");
  const [anoLetivo, setAnoLetivo] = useState<string>("2024/2025");
  const [turnos, setTurnos] = useState<TurnosState>({
    Manhã: true,
    Tarde: true,
    Noite: false,
  });

  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  // STEP 2 – currículo + matriz
  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [curriculumPreset, setCurriculumPreset] = useState<CurriculumKey | null>(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState<SelectedBlueprint | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [presetApplied, setPresetApplied] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // FASE 3 – finalizar
  const [isCompleting, setIsCompleting] = useState(false);

  const canProceedStep1 = !!sessaoAtiva && periodos.length > 0;
  const canProceedStep2 = presetApplied;

  // =========================
  // STEP 1 – criar sessão
  // =========================
  async function handleCreateSession() {
    const toastId = toast.loading("Criando sessão académica...");

    try {
      setCreatingSession(true);

      const [startYearRaw] = anoLetivo.split("/");
      const startYear = (startYearRaw || "").trim();

      if (!startYear || !/^\d{4}$/.test(startYear)) {
        throw new Error("Ano inicial inválido. Use algo como 2024/2025.");
      }

      const res = await fetch(
        `/api/escolas/${escolaId}/onboarding/core/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: schoolDisplayName,
            anoLetivo: Number(startYear),
            esquemaPeriodos: regime,
          }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error || "Falha ao criar/atualizar sessão académica."
        );
      }

      const active = json.data as {
        id: string;
        nome: string;
        data_inicio: string;
        data_fim: string;
        status: "ativa" | "inativa";
      };

      // Atualiza sessão ativa
      setSessaoAtiva({
        id: active.id,
        nome: active.nome,
        status: active.status,
        data_inicio: active.data_inicio,
        data_fim: active.data_fim,
      });

      // Busca períodos gerados para essa sessão
      try {
        const semRes = await fetch(
          `/api/escolas/${escolaId}/semestres?session_id=${encodeURIComponent(
            active.id
          )}`,
          { cache: "no-store" }
        );
        const semJson = await semRes.json().catch(() => null);
        if (semRes.ok && Array.isArray(semJson?.data)) {
          const rows = semJson.data as any[];
          const mapped: Periodo[] = rows.map((row, idx) => ({
            id: row.id,
            nome: row.nome,
            numero: typeof row.numero === "number" ? row.numero : idx + 1,
            data_inicio: String(row.data_inicio),
            data_fim: String(row.data_fim),
          }));
          setPeriodos(mapped);
        } else {
          setPeriodos([]);
        }
      } catch {
        setPeriodos([]);
      }

      toast.success("Sessão académica criada/atualizada com sucesso.", {
        id: toastId,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message || "Erro ao criar/atualizar sessão académica.",
        { id: toastId }
      );
    } finally {
      setCreatingSession(false);
    }
  }

  // =========================
  // STEP 2 – presets & matriz
  // =========================
  const handleTurnoToggle = (turno: keyof TurnosState) => {
    setTurnos((prev) => ({ ...prev, [turno]: !prev[turno] }));
  };

  const handlePresetChange = (key: string) => {
    const k = key as CurriculumKey;
    setCurriculumPreset(k);
    setPresetApplied(false);
  };

  const handleMatrixUpdate = (
    id: number,
    field: "manha" | "tarde" | "noite",
    value: string
  ) => {
    const n = parseInt(value, 10);
    setMatrix((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: isNaN(n) ? 0 : n } : row
      )
    );
  };

  async function handleApplyCurriculumPreset() {
    if (!sessaoAtiva?.id) {
      toast.error("Crie/ative uma sessão primeiro.");
      return;
    }
    if (!curriculumPreset || !selectedBlueprint) {
      toast.error("Selecione um curso/modelo curricular.");
      return;
    }

    const toastId = toast.loading("Aplicando modelo curricular...");

    try {
      setApplyingPreset(true);

      const matrixPayload = matrix.map((row) => ({
        classe: row.nome,
        qtyManha: row.manha || 0,
        qtyTarde: row.tarde || 0,
        qtyNoite: row.noite || 0,
      }));

      const res = await fetch(
        `/api/escolas/${escolaId}/onboarding/curriculum/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessaoAtiva.id,
            presetKey: curriculumPreset,
            matrix: matrixPayload,
          }),
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error || "Falha ao aplicar modelo curricular."
        );
      }

      const created = json.summary || json.data?.summary || json.created || {};
      const msgParts: string[] = [];

      if (created.disciplinas) {
        msgParts.push(`+${created.disciplinas} disciplinas`);
      }
      if (created.classes) {
        msgParts.push(`+${created.classes} classes`);
      }
      if (created.turmas) {
        msgParts.push(`+${created.turmas} turmas`);
      }
      if (created.cursos) {
        msgParts.push(`+${created.cursos} cursos`);
      }

      setPresetApplied(true);

      toast.success(
        msgParts.length
          ? `Modelo aplicado: ${msgParts.join(", ")}.`
          : "Modelo curricular aplicado.",
        { id: toastId }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao aplicar modelo curricular.", {
        id: toastId,
      });
    } finally {
      setApplyingPreset(false);
    }
  }

  // =========================
  // FASE FINAL – concluir
  // =========================
  async function handleCompleteSetup() {
    if (!sessaoAtiva?.id) {
      toast.error(
        "Sessão académica não encontrada. Volte ao passo 1 e crie/seleccione uma sessão."
      );
      return;
    }
    if (!presetApplied) {
      toast.error("Aplique um modelo curricular antes de concluir.");
      return;
    }

    const toastId = toast.loading("Finalizando configuração académica...");

    try {
      setIsCompleting(true);

      const res = await fetch(`/api/escolas/${escolaId}/onboarding/core/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessaoAtiva.id,
          tipo: "academico",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao finalizar onboarding.");
      }

      toast.success("Estrutura académica pronta para uso! 🎉", {
        id: toastId,
      });

      router.push(`/dashboard?escolaId=${escolaId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao finalizar onboarding.", {
        id: toastId,
      });
    } finally {
      setIsCompleting(false);
    }
  }

  function goBack() {
    setStep((prev) => Math.max(1, prev - 1));
  }

  function handleNextClick() {
    if (step === 1) {
      if (!canProceedStep1) {
        toast.error("Crie a sessão académica antes de avançar.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      handleCompleteSetup();
    }
  }

  const pageTitle = step === 1 ? "Identidade & Operação" : "Estrutura Académica";
  const pageDesc = step === 1
    ? "Confirme a identidade da escola e defina o ritmo do ano letivo."
    : "Selecione o curso e gere a matriz de turmas.";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <StepHeader step={step} totalSteps={2} />

      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {pageTitle}
        </h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          {pageDesc}
        </p>
      </header>

      {/* STEP 1 */}
      {step === 1 && (
        <AcademicStep1
          schoolDisplayName={schoolDisplayName}
          setSchoolDisplayName={setSchoolDisplayName}
          regime={regime}
          setRegime={setRegime}
          anoLetivo={anoLetivo}
          setAnoLetivo={setAnoLetivo}
          turnos={turnos}
          onTurnoToggle={handleTurnoToggle}
          sessaoAtiva={sessaoAtiva}
          periodos={periodos}
          creatingSession={creatingSession}
          onCreateSession={handleCreateSession}
        />
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <AcademicStep2
          presetCategory={presetCategory}
          onPresetCategoryChange={setPresetCategory}
          curriculumPreset={curriculumPreset}
          onCurriculumPresetChange={handlePresetChange}
          selectedBlueprint={selectedBlueprint}
          onSelectedBlueprintChange={setSelectedBlueprint}
          matrix={matrix}
          onMatrixChange={setMatrix}
          onMatrixUpdate={handleMatrixUpdate}
          presetApplied={presetApplied}
          applyingPreset={applyingPreset}
          turnos={turnos}
          onApplyCurriculumPreset={handleApplyCurriculumPreset}
        />
      )}

      <StepFooter
        step={step}
        totalSteps={2}
        canProceed={step === 1 ? canProceedStep1 : canProceedStep2}
        onNext={handleNextClick}
        onBack={goBack}
        loading={isCompleting}
      />
    </div>
  );
}