import CarteiraCobrancasClient from "./CarteiraCobrancasClient";

export const dynamic = "force-dynamic";

export default function CobrancasPage() {
  return (
    <div className="p-4 md:p-6">
      <CarteiraCobrancasClient />
    </div>
  );
}
