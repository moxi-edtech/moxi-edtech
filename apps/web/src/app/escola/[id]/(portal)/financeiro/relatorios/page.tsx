import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RelatoriosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: escolaId } = await params;

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Relatórios Financeiros"
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaId}` },
          { label: "Financeiro", href: `/escola/${escolaId}/financeiro` },
          { label: "Relatórios" },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/escola/${escolaId}/financeiro/relatorios/propinas`} className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Propinas</div>
          <div className="text-sm text-gray-600">Resumo mensal e ranking por turma</div>
        </Link>
        <Link href={`/escola/${escolaId}/financeiro/relatorios/fluxo-caixa`} className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Fluxo de Caixa</div>
          <div className="text-sm text-gray-600">Pagamentos por dia (progresso)</div>
        </Link>
        <Link href={`/escola/${escolaId}/financeiro/relatorios/pagamentos-status`} className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Pagamentos por Status</div>
          <div className="text-sm text-gray-600">Distribuição entre pago, pendente, atrasado</div>
        </Link>
        <Link href={`/escola/${escolaId}/financeiro/relatorios/extratos-alunos`} className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Extratos de Alunos</div>
          <div className="text-sm text-gray-600">Gerar extrato (JSON/PDF) por aluno</div>
        </Link>
        <Link href={`/escola/${escolaId}/financeiro/relatorios/detalhados`} className="block bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
          <div className="text-lg font-semibold mb-1">Relatórios Detalhados</div>
          <div className="text-sm text-gray-600">Auditoria por período e exportação</div>
        </Link>
      </div>
    </div>
  );
}
