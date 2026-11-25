import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { Landmark, LockKeyhole } from "lucide-react";
import { InstantWorkspaceTabs } from "@/components/financeiro/InstantWorkspaceTabs";
import ConciliacaoPage from "../conciliacao/page";
import ExpedienteWorkspace from "@/components/secretaria/ExpedienteWorkspace";
import { daySchema, expedienteAccess, todayLuanda } from "@/lib/secretaria/expediente";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControleCaixaPage({
  params,
  searchParams,
}: {
  params: Promise<{id:string}>;
  searchParams?: Promise<{ vista?: "conciliacao" | "fecho"; date?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const access = await expedienteAccess((await params).id);
  if (!access.ok) redirect("/redirect");
  const parsed = daySchema.safeParse(query.date);
  const date = parsed.success && parsed.data <= todayLuanda() ? parsed.data : todayLuanda();
  const vista = query.vista === "fecho" ? "fecho" : "conciliacao";

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
      <InstantWorkspaceTabs
        initialTab={vista}
        ariaLabel="Vistas de controlo de caixa"
        header={
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Controlo de caixa
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
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
            content: <ExpedienteWorkspace escolaId={access.escolaId} initialDate={date} portal="financeiro" embedded />,
          },
        ]}
      />
    </div>
  );
}
