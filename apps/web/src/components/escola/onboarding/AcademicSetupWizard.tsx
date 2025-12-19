"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { toast } from "sonner";
import { CURRICULUM_PRESETS } from "@/lib/onboarding/curriculum-presets";

import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";

import { type CurriculumCategory } from "./academicSetupTypes";

import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
  type PadraoNomenclatura,
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
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
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
  const [padraoNomenclatura, setPadraoNomenclatura] = useState<PadraoNomenclatura>('descritivo_completo');

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
        body: JSON.stringify({ anoLetivo, esquemaPeriodos: regime }),
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
    // --- VALIDAÇÃO CRÍTICA ---
    if (matrix.length === 0) return toast.error("A matriz de turmas está vazia.");
    const totalTurmas = matrix.reduce((acc, r) => acc + (r.manha || 0) + (r.tarde || 0) + (r.noite || 0), 0);
    if (totalTurmas === 0) return toast.error("Defina pelo menos uma turma na matriz.");

    setApplyingPreset(true);
    const toastId = toast.loading("A criar estrutura académica... Este processo pode demorar.");

    try {
      // 1. Agrupar a matriz por curso
      const groupedByCourse = matrix.reduce((acc, row) => {
        const key = row.cursoKey;
        if (!acc[key]) {
          acc[key] = {
            cursoNome: row.cursoNome || key,
            rows: [],
          };
        }
        acc[key].rows.push(row);
        return acc;
      }, {} as Record<string, { cursoNome: string; rows: MatrixRow[] }>);

      // 2. Iterar e chamar a API para cada curso
      for (const cursoKey in groupedByCourse) {
        const courseData = groupedByCourse[cursoKey];
        const { cursoNome, rows } = courseData;

        toast.info(`A processar curso: ${cursoNome}...`, { id: toastId });
        
        // NOVO: Extrair disciplinas do preset
        const blueprint = CURRICULUM_PRESETS[cursoKey as keyof typeof CURRICULUM_PRESETS] || [];
        
        const allSubjectsForCourse = Array.from(new Set(blueprint.map(d => d.nome)));

        const disciplinesByClass = blueprint.reduce((acc, d) => {
          if (!acc[d.classe]) {
            acc[d.classe] = [];
          }
          acc[d.classe].push(d.nome);
          return acc;
        }, {} as Record<string, string[]>);


        // 3. Construir o payload no formato "advancedConfig"
        const payload = {
          presetKey: cursoKey,
          customData: { label: cursoNome },
          advancedConfig: {
            classesNomes: rows.map(r => r.nome),
            turnos: {
              manha: turnos["Manhã"],
              tarde: turnos["Tarde"],
              noite: turnos["Noite"],
            },
            turmasPorCombinacao: rows.reduce((acc, row) => {
              acc[row.nome] = {
                manha: row.manha || 0,
                tarde: row.tarde || 0,
                noite: row.noite || 0,
              };
              return acc;
            }, {} as Record<string, { manha: number; tarde: number; noite: number }>),
            
            // Usar o estado para o padrão de nomenclatura
            padraoNomenclatura: padraoNomenclatura,
            subjects: allSubjectsForCourse, 
            disciplinasPorClasse: disciplinesByClass,
          },
        };

        const res = await fetch(`/api/escolas/${escolaId}/onboarding/curriculum/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorJson = await res.json();
          throw new Error(`Falha ao criar o curso '${cursoNome}': ${errorJson.error || 'Erro desconhecido'}`);
        }
      }

      toast.success("Estrutura académica criada com sucesso! A redirecionar...", { id: toastId });
      
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
          padraoNomenclatura={padraoNomenclatura}
          onPadraoNomenclaturaChange={setPadraoNomenclatura}
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
