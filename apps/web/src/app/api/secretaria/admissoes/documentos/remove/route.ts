import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    escolaId: z.string().uuid(),
    candidaturaId: z.string().uuid(),
    documentKey: z.string().trim().min(1).max(80),
    path: z.string().trim().min(1).max(512),
  })
  .strict();

type JsonRecord = { [key: string]: Json | undefined };
type CandidaturaUpdate = Database["public"]["Tables"]["candidaturas"]["Update"];

function isJsonRecord(value: Json | null | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeAdmissionPath(path: string, escolaId: string, candidaturaId: string) {
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  return path.startsWith(`${escolaId}/${candidaturaId}/`);
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const { escolaId, candidaturaId, documentKey, path } = parsed.data;
  if (!isSafeAdmissionPath(path, escolaId, candidaturaId)) {
    return NextResponse.json({ ok: false, error: "Caminho de documento inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
    return NextResponse.json({ ok: false, error: "Sem vínculo com a escola." }, { status: 403 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: resolvedEscolaId,
    roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const { data: candidatura, error: loadError } = await supabase
    .from("candidaturas")
    .select("id, escola_id, dados_candidato")
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ ok: false, error: loadError.message }, { status: 400 });
  }
  if (!candidatura) {
    return NextResponse.json({ ok: false, error: "Candidatura não encontrada." }, { status: 404 });
  }

  const dados = isJsonRecord(candidatura.dados_candidato) ? candidatura.dados_candidato : {};
  const documentos = isJsonRecord(dados.documentos) ? dados.documentos : {};
  const previousPath = typeof documentos[documentKey] === "string" ? documentos[documentKey] : null;

  const nextDocumentos: JsonRecord = { ...documentos };
  if (previousPath === path) {
    delete nextDocumentos[documentKey];
  }

  const nextDados: JsonRecord = {
    ...dados,
    documentos: nextDocumentos,
  };

  const updatePayload: CandidaturaUpdate = {
    dados_candidato: nextDados,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("candidaturas")
    .update(updatePayload)
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
  }

  const { error: storageError } = await supabase.storage.from("candidaturas").remove([path]);

  await recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "admissao.documento.removido",
    entity: "candidaturas",
    entityId: candidaturaId,
    details: {
      document_key: documentKey,
      path,
      matched_candidatura_json: previousPath === path,
      storage_removed: !storageError,
      storage_error: storageError?.message ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    removed_from_json: previousPath === path,
    storage_removed: !storageError,
    storage_error: storageError?.message ?? null,
  });
}
