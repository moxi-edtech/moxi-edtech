import { OperationalPaymentReceiptDocument } from "@/app/secretaria/pagamentos/_print/OperationalPaymentReceiptDocument";

export const dynamic = "force-dynamic";

export default async function SchoolOperationalPaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string; pagamentoId: string }>;
}) {
  const { id, pagamentoId } = await params;
  return (
    <OperationalPaymentReceiptDocument
      paymentId={pagamentoId}
      requestedEscolaId={id}
    />
  );
}
