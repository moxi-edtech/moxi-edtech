import { AdmissionReceiptRecovery } from "@/components/secretaria/AdmissionReceiptRecovery";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Independent, bookmarkable receipt handoff. No payment or document mutation.
 * The authenticated recovery API checks tenant, role, settled payment and
 * existing non-revoked receipt before returning a print URL.
 */
export default async function ReceiptFollowupPage({
  searchParams,
}: {
  searchParams: Promise<{ pagamento_id?: string }>;
}) {
  const { pagamento_id: pagamentoId } = await searchParams;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-10 text-foreground">
      <h1 className="text-xl font-semibold">Consultar recibo</h1>
      {!pagamentoId || !UUID.test(pagamentoId) ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Referência de pagamento inválida. Consulte o histórico financeiro do aluno.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            O processamento do recibo é independente da confirmação do pagamento.
            Pode fechar o Balcão; esta página permite consultar e imprimir o documento emitido,
            sem repetir a cobrança.
          </p>
          <AdmissionReceiptRecovery pagamentoId={pagamentoId} />
        </>
      )}
    </main>
  );
}
