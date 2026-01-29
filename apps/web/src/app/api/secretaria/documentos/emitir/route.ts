import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import type { Database } from "~types/supabase";

const payloadSchema = z.object({
  alunoId: z.string().uuid(),
  escolaId: z.string().uuid(),
  tipoDocumento: z.enum([
    "declaracao_frequencia",
    "declaracao_notas",
    "cartao_estudante",
    "ficha_inscricao",
  ]),
});

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const { alunoId, escolaId, tipoDocumento } = parsed.data;
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
    .select(
      `id, aluno_id, turma_id, ano_letivo, status,
       alunos ( id, nome, nome_completo, bi_numero ),
       turmas ( id, nome, turno, classes ( nome ), cursos ( nome ) )`
    )
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .in("status", ["ativa", "ativo"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matriculaError || !matricula) {
    return NextResponse.json(
      { ok: false, error: "Matrícula ativa não encontrada" },
      { status: 404 }
    );
  }

  const aluno = (matricula as any).alunos || {};
  const turma = (matricula as any).turmas || {};

  const hashBase = `${randomUUID()}-${matricula.id}-${Date.now()}`;
  const hashValidacao = createHash("sha256").update(hashBase).digest("hex");

  const snapshot = {
    aluno_id: alunoId,
    aluno_nome: aluno.nome_completo || aluno.nome || "",
    aluno_bi: aluno.bi_numero || null,
    matricula_id: matricula.id,
    turma_id: turma.id || null,
    turma_nome: turma.nome || null,
    turma_turno: turma.turno || null,
    classe_nome: turma.classes?.nome || null,
    curso_nome: turma.cursos?.nome || null,
    ano_letivo: matricula.ano_letivo || null,
    tipo_documento: tipoDocumento,
    hash_validacao: hashValidacao,
  };

  const insertPayload: Database["public"]["Tables"]["documentos_emitidos"]["Insert"] = {
    escola_id: escolaId,
    aluno_id: alunoId,
    tipo: tipoDocumento,
    dados_snapshot:
      snapshot as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["dados_snapshot"],
    created_by: user.id,
    hash_validacao: hashValidacao,
  };

  const { data: doc, error: docError } = await supabase
    .from("documentos_emitidos")
    .insert(insertPayload)
    .select("id, public_id")
    .single();

  if (docError || !doc) {
    return NextResponse.json({ ok: false, error: docError?.message || "Falha ao emitir" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    docId: doc.id,
    publicId: doc.public_id,
    hash: hashValidacao,
    tipo: tipoDocumento,
  });
}
