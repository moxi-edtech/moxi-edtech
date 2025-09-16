
export default function FinanceiroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-red-100">
      <h1 className="text-2xl font-bold text-red-700">💰 Portal Financeiro</h1>
    </div>
  );
}
import PortalLayout from "@/components/layout/PortalLayout";

export default function DashboardPage() {
  return (
    <PortalLayout>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow hover:-translate-y-1 transition">
          <h2 className="text-gray-600 text-sm font-medium">Matrículas Ativas</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">324</p>
          <p className="text-gray-400 text-sm">Total de alunos ativos</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:-translate-y-1 transition">
          <h2 className="text-gray-600 text-sm font-medium">Notas Lançadas</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">1.248</p>
          <p className="text-gray-400 text-sm">No último mês</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:-translate-y-1 transition">
          <h2 className="text-gray-600 text-sm font-medium">Pagamentos</h2>
          <p className="tegoodxt-3xl font-bold text-indigo-600 mt-2">97%</p>
          <p className="text-gray-400 text-sm">Taxa de recebimento</p>
        </div>
      </div>
    </PortalLayout>
  );
}
