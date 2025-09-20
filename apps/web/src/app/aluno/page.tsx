import StudentPortalLayout from "@/components/layout/StudentPortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"

export default function Page() {
  return (
    <StudentPortalLayout>
      <AuditPageView portal="aluno" action="PAGE_VIEW" entity="home" />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Próxima aula</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">Matemática</p>
          <p className="text-gray-400 text-sm">Hoje às 14:00</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Notas recentes</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">8.7</p>
          <p className="text-gray-400 text-sm">Média parcial</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Pagamentos</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">Em dia</p>
          <p className="text-gray-400 text-sm">Sem pendências</p>
        </div>
      </div>
    </StudentPortalLayout>
  );
}
