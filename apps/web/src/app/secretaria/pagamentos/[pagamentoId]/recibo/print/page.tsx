import { OperationalPaymentReceiptDocument } from "@/app/secretaria/pagamentos/_print/OperationalPaymentReceiptDocument";

export const dynamic = "force-dynamic";

export default async function OperationalPaymentReceiptPage({
  params,
}: {
  params: Promise<{ pagamentoId: string }>;
}) {
  const { pagamentoId } = await params;
  return <OperationalPaymentReceiptDocument paymentId={pagamentoId} />;
}
