import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";

type Props = {
  params: { id: string };
};

export default function OnboardingPage({ params }: Props) {
  // O ID da escola agora vem dos parâmetros da rota, que é mais robusto
  const escolaId = params.id;

  if (!escolaId) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Selecione uma escola
        </h1>
        <p className="text-sm text-slate-500">
          Esta página de onboarding precisa de um <code>escolaId</code> válido.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <AcademicSetupWizard escolaId={escolaId} />
    </div>
  );
}
