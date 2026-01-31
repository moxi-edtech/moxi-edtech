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
    "historico",
    "certificado",
  ]),
  ano_letivo: z.number().int().optional(), // Ano letivo para documentos finais
});

const FINAL_DOCUMENT_TYPES = ["declaracao_notas", "historico", "certificado"];

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>();
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

  const { alunoId, escolaId, tipoDocumento, ano_letivo } = parsed.data;
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

  // Se for um documento final, usa a nova RPC baseada no histórico
  if (FINAL_DOCUMENT_TYPES.includes(tipoDocumento)) {
    if (!ano_letivo) {
      return NextResponse.json({ ok: false, error: "O ano letivo é obrigatório para este tipo de documento." }, { status: 400 });
    }

    const { data: result, error: rpcError } = await supabase
      .rpc("emitir_documento_final", {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_ano_letivo: ano_letivo,
        p_tipo_documento: tipoDocumento,
      })
      .single();

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  // Lógica antiga para documentos baseados na matrícula ativa
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

  const { data: numeroSequencial, error: numeroError } = await supabase
    .rpc("next_documento_numero", { p_escola_id: escolaId });
  if (numeroError) {
    return NextResponse.json({ ok: false, error: numeroError.message }, { status: 400 });
  }

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
    numero_sequencial: numeroSequencial ?? null,
    hash_validacao: hashValidacao,
  };

  const insertPayload: Database["public"]["Tables"]["documentos_emitidos"]["Insert"] = {
    escola_id: escolaId,
    aluno_id: alunoId,
    numero_sequencial: numeroSequencial ?? null,
    tipo: tipoDocumento as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["tipo"],
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
