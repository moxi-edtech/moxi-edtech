import type { SupabaseClient } from "@supabase/supabase-js";
import { requireFeature } from "@/lib/plan/requireFeature";
import { resolveAcademicYearContext, assertAcademicYearEntity } from "@/lib/academic-year/context";
import { readVerifiedAcademicTrimesters, requireVerifiedTrimester } from "@/lib/academico/read-verified-academic-trimesters";
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico";
import { getOfficialRaaPublicationAt } from "@/lib/academico/raa-pauta-publication";
import type { BalcaoAcademicOperation } from "@/lib/rematricula/balcao-academic-operation";

type PublicationInput = {
  db: SupabaseClient; escolaId: string; key: string;
  source: { id: string; turma_id: string; session_id: string };
  body: Extract<BalcaoAcademicOperation, { acao: "publicar_pauta" }>;
};
function publicationError(message: string, code = "PAUTA_NOT_PUBLISHED", status = 409) {
  return Object.assign(new Error(message), { code, status });
}
export async function publishBalcaoPauta({ db, escolaId, source, body, key }: PublicationInput) {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw publicationError("A sessão expirou. Entre novamente antes de publicar.", "UNAUTHENTICATED", 401);
  await requireFeature("doc_qr_code");
  const year = await resolveAcademicYearContext(db, { userId: auth.user.id, requestedAcademicYearId: source.session_id, operation: "WRITE" });
  await assertAcademicYearEntity(db, { table: "turmas", entityId: source.turma_id, escolaId, anoLetivoId: year.anoLetivoId });
  const periods = await readVerifiedAcademicTrimesters(db, { escolaId, anoLetivoId: source.session_id, yearBase: Number(year.anoLetivoLabel.split("/")[0]) });
  const period = requireVerifiedTrimester(periods, { id: body.periodo_id });
  const periodNumber = period.numero;
  if (periodNumber == null) throw publicationError("O trimestre precisa de configuração oficial.");
  const regime = await resolveRegimeAcademico(db, source.turma_id);
  if (regime.escala === "qualitativa" && body.tipo !== "anual") throw publicationError("A avaliação qualitativa oficial é anual. Selecione a pauta anual.");
  const { data: claim, error: claimError } = await db.rpc("balcao_resolver_academico", {
    p_escola_id: escolaId, p_matricula_id: source.id, p_acao: "preparar_publicacao", p_chave: key,
    p_payload: { motivo: body.motivo, periodo_id: body.periodo_id, tipo: body.tipo },
  });
  if (claimError || !claim?.id) throw publicationError("Existe uma publicação em curso ou o contexto mudou. Aguarde e tente novamente.");
  if (claim.busy) throw publicationError("A pauta está em processamento. Aguarde e confirme novamente.", "PAUTA_PROCESSING");
  if (claim.status !== "SUCCESS") {
    try {
      const pdf = body.tipo === "anual" ? await (async () => {
        const { buildPautaAnualPayload, renderPautaAnualBuffer } = await import("./pauta-anual");
        return renderPautaAnualBuffer(await buildPautaAnualPayload({ supabase: db, escolaId, turmaId: source.turma_id }));
      })() : await (async () => {
        const { buildPautaGeralPayload, renderPautaGeralBuffer } = await import("./pauta-geral");
        return renderPautaGeralBuffer(await buildPautaGeralPayload({ supabase: db, escolaId, turmaId: source.turma_id, periodoNumero: periodNumber }));
      })();
      if (pdf.length < 800) throw new Error("O documento gerado é inválido.");
      const { error: uploadError } = await db.storage.from("pautas_oficiais_fechadas").upload(claim.pdf_path, Buffer.from(pdf), { upsert: true, contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const { error: completionError } = await db.rpc("balcao_concluir_publicacao", {
        p_escola_id: escolaId, p_matricula_id: source.id, p_chave: key, p_token: claim.token, p_sucesso: true,
      });
      if (completionError) throw new Error("O PDF foi enviado, mas a publicação ainda não foi confirmada. Repita a confirmação.");
    } catch (error) {
      // Failure does not erase an earlier official PDF. The claimed path is
      // unique to this operation; a retry retains the same ownership token.
      await db.rpc("balcao_concluir_publicacao", { p_escola_id: escolaId, p_matricula_id: source.id, p_chave: key, p_token: claim.token, p_sucesso: false });
      throw publicationError(error instanceof Error ? error.message : "A pauta não foi publicada.");
    }
  }
  const { data: persisted, error } = await db.from("pautas_oficiais")
    .select("id,status,pdf_path,generated_at,updated_at").eq("escola_id", escolaId).eq("id", claim.id).maybeSingle();
  if (error || !persisted || persisted.pdf_path !== claim.pdf_path || !getOfficialRaaPublicationAt(persisted)) throw publicationError("A publicação oficial ainda não foi confirmada.");
  const { data: signed, error: signedError } = await db.storage.from("pautas_oficiais_fechadas").createSignedUrl(persisted.pdf_path, 3600);
  if (signedError || !signed?.signedUrl) throw publicationError("Pauta publicada. Não foi possível obter o acesso ao PDF; confirme novamente.", "PAUTA_LINK_PENDING", 503);
  return { ok: true, status: "SUCCESS", id: claim.id, download_url: signed.signedUrl };
}
