/** SUCCESS with an uploaded PDF is the contract used by the official pauta endpoints.
 * generated_at can predate PROCESSING -> SUCCESS. The updated_at trigger records
 * the most recent transition to SUCCESS; never start an appeal at PROCESSING.
 * A future immutable published_at column would be required if metadata-only
 * edits to completed artifacts are introduced.
 */
export type RaaPautaPublication = {
  status?: string | null;
  pdf_path?: string | null;
  generated_at?: string | null;
  updated_at?: string | null;
};

export function getOfficialRaaPublicationAt(pauta: RaaPautaPublication | null | undefined): Date | null {
  if (pauta?.status !== "SUCCESS" || !pauta.pdf_path?.trim()) return null;
  const generatedMs = Date.parse(pauta.generated_at ?? "");
  const completedMs = Date.parse(pauta.updated_at ?? "");
  if (!Number.isFinite(generatedMs) || !Number.isFinite(completedMs)) return null;
  const at = Math.max(generatedMs, completedMs);
  if (at > Date.now()) return null;
  return new Date(at);
}
