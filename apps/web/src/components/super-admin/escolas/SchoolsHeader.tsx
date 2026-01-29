import { useRouter } from "next/navigation";
import { BoltIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";

type SchoolsHeaderProps = {
  fallbackSource?: string | null;
  onRepairAdmins: (dryRun: boolean) => void;
  loading: boolean;
};

export function SchoolsHeader({ fallbackSource, onRepairAdmins, loading }: SchoolsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          Gestão de Escolas
          {fallbackSource && (
            <span
              title="Fallback ativo: usando tabela básica por ausência da view. Contagens podem ser aproximadas."
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
            >
              Fallback ativo
            </span>
          )}
        </h1>
        <p className="text-gray-600 mt-1">Visualize e gerencie todas as escolas do sistema</p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => onRepairAdmins(true)} disabled={loading} variant="outline" tone="gray" size="sm" className="inline-flex items-center gap-2 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100">
          <BoltIcon className="w-5 h-5" /> Reparar Admins (Dry‑Run)
        </Button>
        <Button onClick={() => onRepairAdmins(false)} disabled={loading} variant="outline" tone="gray" size="sm" className="inline-flex items-center gap-2 border-green-300 text-green-900 bg-green-50 hover:bg-green-100">
          <BoltIcon className="w-5 h-5" /> Reparar Admins
        </Button>
        <Button onClick={() => router.push("/super-admin/escolas/nova")} tone="blue" size="sm" className="inline-flex items-center gap-2 px-4">
          <PlusCircleIcon className="w-5 h-5" /> Nova Escola
        </Button>
      </div>
    </div>
  );
}
