/**
 * Confirm uniqueness at the database boundary, not merely with an optimistic
 * SELECT. This is the shared path for replaying a payment receipt when no
 * recurring-tuition id exists. A UNIQUE (escola_id,idempotency_key) index is
 * required; a 23505 is never assumed to be our receipt without verification.
 */
export type ReceiptInsertError = { code?: string | null; message?: string };
export type ReceiptPersistenceResult = "created" | "already_exists";

export async function persistReceiptOnce(args: {
  exists: () => Promise<boolean>;
  insert: () => Promise<{ error: ReceiptInsertError | null }>;
}): Promise<ReceiptPersistenceResult> {
  if (await args.exists()) return "already_exists";
  const { error } = await args.insert();
  if (!error) return "created";
  if (error.code === "23505" && await args.exists()) return "already_exists";
  // PostgREST errors are plain objects, not Error instances. Rethrowing them
  // turns outbox last_error into "[object Object]" and hides the SQLSTATE.
  const failure = new Error(error.message ?? "RECIBO_INSERT_FAILED") as Error & { code?: string };
  failure.code = error.code ?? undefined;
  throw failure;
}
