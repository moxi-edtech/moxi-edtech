"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UserGroupIcon, PlusIcon } from "@heroicons/react/24/outline";

export default function FuncionariosPage() {
  const p = useParams() as Record<string, string | string[] | undefined>;
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B2C45] flex items-center gap-2">
          <UserGroupIcon className="w-6 h-6" />
          Funcionários da Escola
        </h1>
        <Link href={`/escola/${escolaId}/funcionarios/novo`}>
          <Button tone="teal">
            <PlusIcon className="w-5 h-5" />
            Cadastrar Funcionário
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 p-6 text-sm text-gray-600">
        Em breve: lista e gerenciamento de funcionários. Por enquanto, use o botão acima para cadastrar novos.
      </div>
    </div>
  );
}
