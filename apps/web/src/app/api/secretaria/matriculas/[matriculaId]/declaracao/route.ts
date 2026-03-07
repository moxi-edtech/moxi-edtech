import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { recordAuditServer } from "@/lib/audit";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchAlunoNotificacao } from "@/lib/notificacoes/dispatchAlunoNotificacao";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUNSET_DATE = "2027-03-31";
const REPLACEMENT_ENDPOINT = "/api/secretaria/documentos/emitir";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matriculaId: string }> }
) {
  const { matriculaId } = await params;
  const supabase = await supabaseServerTyped<Database>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }

  const { data: matricula, error: matriculaError } = await supabase
    .from("matriculas")
    .select(`
      id, aluno_id, turma_id, ano_letivo, status,
      alunos ( id, nome, nome_completo, bi_numero ),
      turmas ( id, nome, turno, classes ( nome ), cursos ( nome ) )
    `)
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .single();

  if (matriculaError || !matricula?.aluno_id) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }

  const deprecationPayload = {
    deprecated: true,
    sunset_date: SUNSET_DATE,
    replacement_endpoint: REPLACEMENT_ENDPOINT,
  } as const;

  const aluno = (matricula as any).alunos || {};
  const turma = (matricula as any).turmas || {};

  const hashBase = `${randomUUID()}-${matricula.id}-${Date.now()}`;
  const hashValidacao = createHash("sha256").update(hashBase).digest("hex");

  const { data: numeroSequencial, error: numeroError } = await supabase
    .rpc("next_documento_numero", { p_escola_id: escolaId });

  if (numeroError) {
    return NextResponse.json({ ok: false, error: numeroError.message, ...deprecationPayload }, { status: 400 });
  }

  const snapshot = {
    aluno_id: matricula.aluno_id,
    aluno_nome: aluno.nome_completo || aluno.nome || "",
    aluno_bi: aluno.bi_numero || null,
    matricula_id: matricula.id,
    turma_id: turma.id || null,
    turma_nome: turma.nome || null,
    turma_turno: turma.turno || null,
    classe_nome: turma.classes?.nome || null,
    curso_nome: turma.cursos?.nome || null,
    ano_letivo: matricula.ano_letivo || null,
    tipo_documento: "declaracao_frequencia",
    numero_sequencial: numeroSequencial ?? null,
    hash_validacao: hashValidacao,
  };

  const { data: doc, error: docError } = await supabase
    .from("documentos_emitidos")
    .insert({
      escola_id: escolaId,
      aluno_id: matricula.aluno_id,
      numero_sequencial: numeroSequencial ?? null,
      tipo: "declaracao_frequencia" as any,
      dados_snapshot: snapshot as any,
      created_by: user.id,
      hash_validacao: hashValidacao,
    })
    .select("id, public_id")
    .single();

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "LEGACY_ENDPOINT_USED",
    entity: "api_legacy",
    entityId: matriculaId,
    details: {
      endpoint: "/api/secretaria/matriculas/[matriculaId]/declaracao",
      replacement_endpoint: REPLACEMENT_ENDPOINT,
      matricula_id: matriculaId,
      aluno_id: matricula.aluno_id,
      doc_status: docError ? 400 : 200,
      deprecated: true,
      sunset_date: SUNSET_DATE,
    },
  }).catch(() => null);

  if (docError || !doc) {
    return NextResponse.json({ ok: false, error: docError?.message || "Falha ao emitir", ...deprecationPayload }, { status: 400 });
  }

  await dispatchAlunoNotificacao({
    escolaId,
    key: "DOCUMENTO_EMITIDO",
    alunoIds: [matricula.aluno_id],
    params: { actionUrl: "/aluno/documentos" },
    actorId: user.id,
    actorRole: "secretaria",
    agrupamentoTTLHoras: 12,
  });

  const response = NextResponse.json({
    ok: true,
    docId: doc.id,
    publicId: doc.public_id,
    hash: hashValidacao,
    tipo: "declaracao_frequencia",
    print_url: `/secretaria/documentos/${doc.id}/frequencia/print`,
    ...deprecationPayload,
  });

  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", `${SUNSET_DATE}T23:59:59Z`);
  response.headers.set("Link", `<${REPLACEMENT_ENDPOINT}>; rel="successor-version"`);
  response.headers.set("X-Deprecated-Endpoint", "true");
  response.headers.set("X-Replacement-Endpoint", REPLACEMENT_ENDPOINT);
  response.headers.set("Warning", `299 - "Deprecated endpoint. Use ${REPLACEMENT_ENDPOINT} until ${SUNSET_DATE}."`);

  return response;
}
