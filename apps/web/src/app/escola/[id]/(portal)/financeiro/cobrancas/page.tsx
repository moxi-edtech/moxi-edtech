import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import CarteiraCobrancasClient from "./CarteiraCobrancasClient";

export const dynamic = "force-dynamic";

export default function CobrancasPage() {
  return (
    <div className={PORTAL_PAGE_INSET}>
      <CarteiraCobrancasClient />
    </div>
  );
}
