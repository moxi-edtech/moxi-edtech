import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { ClipboardDocumentListIcon, PencilSquareIcon, MapIcon } from "@heroicons/react/24/outline";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light/20 to-white text-moxinexa-dark">
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-moxinexa-navy">Portal do Professor</h1>
          <p className="text-sm text-moxinexa-gray mt-1">Acesse rapidamente seus fluxos de trabalho.</p>
        </header>
        <AssignmentsBanner />
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="/professor/frequencias" className="block rounded-2xl border border-moxinexa-light/30 bg-white p-5 hover:border-moxinexa-teal/40 transition">
            <div className="w-10 h-10 rounded-lg bg-moxinexa-teal/10 text-moxinexa-teal flex items-center justify-center mb-3">
              <ClipboardDocumentListIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-moxinexa-navy">Registrar Presenças</div>
            <div className="text-sm text-moxinexa-gray">Por turma e disciplina (com disciplina_id)</div>
          </a>
          <a href="/professor/notas" className="block rounded-2xl border border-moxinexa-light/30 bg-white p-5 hover:border-moxinexa-teal/40 transition">
            <div className="w-10 h-10 rounded-lg bg-moxinexa-teal/10 text-moxinexa-teal flex items-center justify-center mb-3">
              <PencilSquareIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-moxinexa-navy">Lançar Notas</div>
            <div className="text-sm text-moxinexa-gray">Por turma e disciplina (com disciplina_id)</div>
          </a>
          <a href="/professor/fluxos" className="block rounded-2xl border border-moxinexa-light/30 bg-white p-5 hover:border-moxinexa-teal/40 transition">
            <div className="w-10 h-10 rounded-lg bg-moxinexa-teal/10 text-moxinexa-teal flex items-center justify-center mb-3">
              <MapIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-moxinexa-navy">Ver Fluxo Acadêmico</div>
            <div className="text-sm text-moxinexa-gray">Passo a passo do processo acadêmico</div>
          </a>
        </div>
      </div>
    </div>
  );
}
