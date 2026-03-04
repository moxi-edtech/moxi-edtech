import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { emitirComprovanteMatricula } from "@/lib/documentos/emitirComprovanteMatricula";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EmitSchema = z.object({
  escolaId: z.string().uuid(),
  matriculaId: z.string().uuid(),
  dataHoraEfetivacao: z.string().datetime(),
  observacao: z.string().max(500).optional(),
});

const QuerySchema = z.object({
  matriculaId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const parsed = EmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const { escolaId, matriculaId, dataHoraEfetivacao, observacao } = parsed.data;
  const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const emitResult = await emitirComprovanteMatricula({
    supabase,
    escolaId,
    matriculaId,
    dataHoraEfetivacao,
    observacao,
    createdBy: user.id,
    audit: {
      portal: "secretaria",
      acao: "COMPROVANTE_MATRICULA_EMITIDO",
    },
  });

  if (!emitResult.ok) {
    return NextResponse.json(
      { ok: false, error: emitResult.error, currentStatus: emitResult.currentStatus },
      { status: emitResult.status }
    );
  }

  return NextResponse.json({
    ok: true,
    reused: emitResult.reused ?? false,
    docId: emitResult.docId,
    publicId: emitResult.publicId,
    hash: emitResult.hash,
    tipo: "comprovante_matricula",
    printUrl: emitResult.printUrl,
  });
}

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedQuery = QuerySchema.safeParse({ matriculaId: url.searchParams.get("matriculaId") });
  if (!parsedQuery.success) {
    return NextResponse.json({ ok: false, error: "matriculaId inválido" }, { status: 400 });
  }

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id")
    .eq("id", parsedQuery.data.matriculaId)
    .single();

  if (!matricula?.escola_id) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, String(matricula.escola_id));
  if (!escolaId || escolaId !== matricula.escola_id) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }

  const { data: doc, error: docError } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, hash_validacao, created_at")
    .eq("escola_id", escolaId)
    .eq("aluno_id", String(matricula.aluno_id))
    .eq("tipo", "comprovante_matricula")
    .contains("dados_snapshot", { matricula_id: parsedQuery.data.matriculaId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ ok: false, error: "Nenhum comprovante encontrado para esta matrícula." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    docId: doc.id,
    publicId: doc.public_id,
    hash: doc.hash_validacao,
    createdAt: doc.created_at,
    printUrl: `/secretaria/documentos/${doc.id}/comprovante-matricula/print`,
  });
}
