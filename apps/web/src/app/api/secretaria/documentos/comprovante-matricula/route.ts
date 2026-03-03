import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FINAL_STATUSES = ["concluido", "transferido", "desistente", "trancado", "inativo"] as const;

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

  const { data: matricula, error: matriculaError } = await supabase
    .from("matriculas")
    .select(`
      id,
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      status,
      created_at,
      updated_at,
      data_matricula,
      alunos ( id, nome, nome_completo, bi_numero ),
      turmas ( id, nome, turno )
    `)
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .single();

  if (matriculaError || !matricula) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }

  const statusMatricula = String(matricula.status ?? "").toLowerCase();
  if (!FINAL_STATUSES.includes(statusMatricula as (typeof FINAL_STATUSES)[number])) {
    return NextResponse.json(
      {
        ok: false,
        error: "Comprovante só pode ser emitido para matrícula em estado final.",
        currentStatus: statusMatricula,
      },
      { status: 422 }
    );
  }

  const { data: existingDoc } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, hash_validacao, created_at")
    .eq("escola_id", escolaId)
    .eq("aluno_id", String(matricula.aluno_id))
    .eq("tipo", "comprovante_matricula")
    .contains("dados_snapshot", { matricula_id: matriculaId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDoc) {
    return NextResponse.json({
      ok: true,
      reused: true,
      docId: existingDoc.id,
      publicId: existingDoc.public_id,
      hash: existingDoc.hash_validacao,
      printUrl: `/secretaria/documentos/${existingDoc.id}/comprovante-matricula/print`,
    });
  }

  const { data: numeroSequencial, error: numeroError } = await supabase.rpc("next_documento_numero", {
    p_escola_id: escolaId,
  });
  if (numeroError) {
    return NextResponse.json({ ok: false, error: numeroError.message }, { status: 400 });
  }

  const hashBase = `${randomUUID()}-${matriculaId}-${Date.now()}`;
  const hashValidacao = createHash("sha256").update(hashBase).digest("hex");
  const aluno = ((matricula as any).alunos ?? {}) as Record<string, unknown>;
  const turma = ((matricula as any).turmas ?? {}) as Record<string, unknown>;

  const snapshot = {
    tipo_documento: "comprovante_matricula",
    matricula_id: matriculaId,
    aluno_id: String(matricula.aluno_id),
    aluno_nome: (aluno.nome_completo as string) || (aluno.nome as string) || "",
    aluno_bi: (aluno.bi_numero as string) || null,
    turma_id: matricula.turma_id ?? null,
    turma_nome: (turma.nome as string) || null,
    turma_turno: (turma.turno as string) || null,
    ano_letivo: matricula.ano_letivo ?? null,
    status_final_matricula: statusMatricula,
    data_hora_efetivacao: dataHoraEfetivacao,
    observacao: observacao ?? null,
    emitido_em: new Date().toISOString(),
    numero_sequencial: numeroSequencial ?? null,
    hash_validacao: hashValidacao,
  };

  const { data: doc, error: docError } = await supabase
    .from("documentos_emitidos")
    .insert({
      escola_id: escolaId,
      aluno_id: String(matricula.aluno_id),
      numero_sequencial: numeroSequencial ?? null,
      tipo: "comprovante_matricula" as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["tipo"],
      dados_snapshot: snapshot as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["dados_snapshot"],
      created_by: user.id,
      hash_validacao: hashValidacao,
    })
    .select("id, public_id, hash_validacao")
    .single();

  if (docError || !doc) {
    return NextResponse.json({ ok: false, error: docError?.message || "Falha ao emitir comprovante." }, { status: 400 });
  }

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "COMPROVANTE_MATRICULA_EMITIDO",
    entity: "documentos_emitidos",
    entityId: doc.id,
    details: {
      matriculaId,
      alunoId: matricula.aluno_id,
      documento_public_id: doc.public_id,
      documento_hash: doc.hash_validacao,
      status_final_matricula: statusMatricula,
      data_hora_efetivacao: dataHoraEfetivacao,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    docId: doc.id,
    publicId: doc.public_id,
    hash: doc.hash_validacao,
    tipo: "comprovante_matricula",
    printUrl: `/secretaria/documentos/${doc.id}/comprovante-matricula/print`,
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
