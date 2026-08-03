import { Landmark, LockKeyhole } from "lucide-react";
import { InstantWorkspaceTabs } from "@/components/financeiro/InstantWorkspaceTabs";
import ConciliacaoPage from "../conciliacao/page";
import FechoCaixaPage from "../fecho/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControleCaixaPage({
  searchParams,
}: {
  searchParams?: Promise<{ vista?: "conciliacao" | "fecho" }>;
}) {
  const query = (await searchParams) ?? {};
  const vista = query.vista === "fecho" ? "fecho" : "conciliacao";

  return (
    <main className="space-y-6 p-4 md:p-6">
      <InstantWorkspaceTabs
        initialTab={vista}
        ariaLabel="Vistas de controlo de caixa"
        header={
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Controlo de caixa
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Confirme entradas bancárias antes de declarar e aprovar o fecho diário.
            </p>
          </>
        }
        tabs={[
          {
            id: "conciliacao",
            label: "Conciliação bancária",
            icon: <Landmark className="h-4 w-4" />,
            content: <ConciliacaoPage />,
          },
          {
            id: "fecho",
            label: "Fecho diário",
            icon: <LockKeyhole className="h-4 w-4" />,
            content: <FechoCaixaPage />,
          },
        ]}
      />
    </main>
  );
}
