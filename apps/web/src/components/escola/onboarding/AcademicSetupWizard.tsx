"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { toast } from "sonner";

import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";

import { type CurriculumCategory } from "./academicSetupTypes";

import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
} from "./academicSetupTypes";

type Props = {
  escolaId: string;
  onComplete?: () => void;
};

export default function AcademicSetupWizard({ escolaId, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // STEP 1
  const [schoolDisplayName, setSchoolDisplayName] = useState<string>("");
  const [regime, setRegime] = useState<"trimestral" | "semestral" | "bimestral">("trimestral");
  const [anoLetivo, setAnoLetivo] = useState<string>("2024/2025");
  const [turnos, setTurnos] = useState<TurnosState>({
    "Manhã": true,
    "Tarde": true,
    "Noite": false,
  });

  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  // STEP 2
  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // Load School Name
  useEffect(() => {
    async function fetchSchoolName() {
      try {
        const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" });
        const json = await res.json();
        if (json?.nome) setSchoolDisplayName(json.nome);
      } catch (error) { console.error(error); }
    }
    if (escolaId) fetchSchoolName();
  }, [escolaId]);

  // Actions
  const handleTurnoToggle = (t: keyof TurnosState) => {
    setTurnos(prev => ({ ...prev, [t]: !prev[t] }));
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    const toastId = toast.loading("Criando sessão...");
    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/core/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anoLetivo: parseInt(anoLetivo.split('/')[0]), esquemaPeriodos: regime }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar sessão.");
      setSessaoAtiva(json.data);
      toast.success("Sessão criada.", { id: toastId });
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setCreatingSession(false);
    }
  };

  const handleMatrixUpdate = (id: string | number, field: "manha" | "tarde" | "noite", value: string) => {
    const val = parseInt(value) || 0;
    setMatrix(prev => prev.map(row => row.id === id ? { ...row, [field]: Math.max(0, val) } : row));
  };

  const handleApplyCurriculumPreset = async () => {
    if (!sessaoAtiva?.id) return toast.error("Sessão não encontrada.");
    
    // --- VALIDAÇÃO CRÍTICA: MATRIX CHEIA ---
    if (matrix.length === 0) return toast.error("A matriz está vazia.");
    
    const totalTurmas = matrix.reduce((acc, r) => acc + (r.manha||0) + (r.tarde||0) + (r.noite||0), 0);
    if (totalTurmas === 0) return toast.error("Defina pelo menos uma turma.");

    setApplyingPreset(true);
    const toastId = toast.loading("A criar estrutura...");

    try {
      const payload = {
        sessionId: sessaoAtiva.id,
        presetKey: "custom_matrix",
        matrix: matrix.map(row => ({
          classe: row.nome,
          // Se o cursoKey não existir (legado), assume 'geral'
          cursoKey: (row as any).cursoKey || 'geral',
          qtyManha: row.manha || 0,
          qtyTarde: row.tarde || 0,
          qtyNoite: row.noite || 0
        }))
      };

      const res = await fetch(`/api/escolas/${escolaId}/onboarding/curriculum/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Falha ao salvar.");

      toast.success("Sucesso! A redirecionar...", { id: toastId });
      
      if (onComplete) onComplete();
      else window.location.href = `/escola/${escolaId}/admin/dashboard`;

    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setApplyingPreset(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!sessaoAtiva) { toast.error("Crie a sessão primeiro."); return; }
      setStep(2);
    } else {
      handleApplyCurriculumPreset();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 pb-32">
      <StepHeader step={step} totalSteps={2} />

      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {step === 1 ? "Identidade & Operação" : "Estrutura Académica"}
        </h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          {step === 1 ? "Identidade e ano letivo." : "Defina a matriz de turmas."}
        </p>
      </header>

      {step === 1 && (
        <AcademicStep1
          schoolDisplayName={schoolDisplayName}
          setSchoolDisplayName={setSchoolDisplayName}
          regime={regime as any}
          setRegime={(val) => setRegime(val as typeof regime)}
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

      {step === 2 && (
        <AcademicStep2
          presetCategory={presetCategory}
          onPresetCategoryChange={setPresetCategory}
          matrix={matrix}
          onMatrixChange={setMatrix}
          onMatrixUpdate={handleMatrixUpdate}
          turnos={turnos}
          onApplyCurriculumPreset={handleApplyCurriculumPreset}
          applyingPreset={applyingPreset}
        />
      )}

      <StepFooter
        step={step}
        totalSteps={2}
        canProceed={step === 1 ? !!sessaoAtiva : matrix.length > 0}
        onNext={handleNext}
        onBack={() => setStep(p => Math.max(1, p-1))}
        loading={applyingPreset}
      />
    </div>
  );
}
