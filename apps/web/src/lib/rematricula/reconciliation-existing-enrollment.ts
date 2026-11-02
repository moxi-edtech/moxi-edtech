/**
 * UI-capability hint only. The reconciliation POST revalidates payment,
 * school, student, year, existing enrollment and permissions before writing.
 * Never infer settlement from pending service requests or payment intents.
 */
export function canLinkPaidOrderToExistingEnrollment(args: {
  requestStatus: string | null | undefined;
  paymentSettled: boolean;
  requestTargetYearId: string | null | undefined;
  selectedTargetYearId: string | null | undefined;
  requestTurmaId: string | null | undefined;
  existingEnrollmentId: string | null | undefined;
  existingTurmaId: string | null | undefined;
  sourceEnrollmentId: string | null | undefined;
}): boolean {
  return args.requestStatus === "pending_payment" &&
    args.paymentSettled &&
    Boolean(args.selectedTargetYearId &&
      args.requestTargetYearId === args.selectedTargetYearId) &&
    Boolean(args.requestTurmaId && args.existingTurmaId &&
      args.requestTurmaId === args.existingTurmaId) &&
    Boolean(args.existingEnrollmentId && args.sourceEnrollmentId &&
      args.existingEnrollmentId !== args.sourceEnrollmentId);
}
