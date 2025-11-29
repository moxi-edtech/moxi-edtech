import Link from "next/link";

const RelatoriosPage = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-moxinexa-navy">Relatórios Financeiros</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/financeiro/relatorios/propinas" className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Propinas</div>
          <div className="text-sm text-gray-600">Resumo mensal e ranking por turma</div>
        </Link>
        <Link href="/financeiro/relatorios/fluxo-caixa" className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Fluxo de Caixa</div>
          <div className="text-sm text-gray-600">Pagamentos por dia (progresso)</div>
        </Link>
        <Link href="/financeiro/relatorios/pagamentos-status" className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Pagamentos por Status</div>
          <div className="text-sm text-gray-600">Distribuição entre pago, pendente, atrasado</div>
        </Link>
        <Link href="/financeiro/relatorios/detalhados" className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Relatórios Detalhados</div>
          <div className="text-sm text-gray-600">Eventos e ações (auditoria) do financeiro</div>
        </Link>
        <Link href="/financeiro/relatorios/extratos-alunos" className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Extratos de Alunos</div>
          <div className="text-sm text-gray-600">Gerar extrato (JSON/PDF) por aluno</div>
        </Link>
      </div>
    </div>
  );
};

export default RelatoriosPage;
