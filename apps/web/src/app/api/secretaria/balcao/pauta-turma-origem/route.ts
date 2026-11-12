import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Staff = [
  "secretaria", "admin_secretaria", "admin_secretario", "admin_financeiro",
  "admin", "admin_escola", "staff_admin", "diretor",
] as const;
const GetParams = z.object({ aluno_id: z.string().uuid(), matricula_id: z.string().uuid() });
const PostBody = GetParams.extend({ turma_id: z.string().uuid() });

async function context() {
  const db = await supabaseServerTyped<any>();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 }) };
  const authz = await requireRoleInSchool({ supabase: db, escolaId, roles: [...Staff] });
  if (authz.error) return { error: authz.error };
  return { db, escolaId };
}

async function sourceContext(db: any, escolaId: string, alunoId: string, matriculaId: string) {
  const { data: source, error } = await db.from("matriculas")
    .select("id,aluno_id,escola_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem")
    .eq("escola_id", escolaId).eq("aluno_id", alunoId).eq("id", matriculaId)
    .maybeSingle();
  if (error) throw error;
  if (!source?.turma_id || !source?.session_id) return null;
  const { data: turma, error: turmaError } = await db.from("turmas")
    .select("id,nome,curso_id,classe_num,session_id,ano_letivo")
    .eq("escola_id", escolaId).eq("id", source.turma_id)
    .eq("session_id", source.session_id).maybeSingle();
  if (turmaError) throw turmaError;
  if (!turma?.curso_id) return null;
  return { source, turma };
}

/** Pupil-specific choice of the actual prior-year class from the physical pauta. */
export async function GET(req: NextRequest) {
  try {
    const parsed = GetParams.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Aluno inválido." }, { status: 400 });
    const session = await context();
    if ("error" in session) return session.error!;
    const { db, escolaId } = session;
    const selected = await sourceContext(db, escolaId, parsed.data.aluno_id, parsed.data.matricula_id);
    if (!selected) return NextResponse.json({ ok: false, error: "Matrícula de origem não encontrada." }, { status: 404 });

    const { data: turmas, error } = await db.from("turmas")
      .select("id,nome,classe_num,turno")
      .eq("escola_id", escolaId)
      .eq("session_id", selected.source.session_id)
      .eq("curso_id", selected.turma.curso_id)
      .eq("status_validacao", "ativo")
      .order("classe_num", { ascending: true }).order("nome", { ascending: true }).limit(100);
    if (error) throw error;
    return NextResponse.json({
      ok: true, matricula_id: selected.source.id,
      turma_atual_id: selected.source.turma_id,
      turma_atual_nome: selected.turma.nome,
      ano_letivo: selected.source.ano_letivo,
      items: turmas ?? [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[BALCAO-PAUTA-TURMA-GET]", err);
    return NextResponse.json({ ok: false, error: "Não foi possível consultar as turmas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = PostBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Selecione a turma correta da pauta." }, { status: 400 });
    const session = await context();
    if ("error" in session) return session.error!;
    const { db, escolaId } = session;
    const { aluno_id, matricula_id, turma_id } = parsed.data;
    const selected = await sourceContext(db, escolaId, aluno_id, matricula_id);
    if (!selected) return NextResponse.json({ ok: false, error: "Matrícula de origem não encontrada." }, { status: 404 });
    if (selected.source.turma_id === turma_id) {
      return NextResponse.json({ ok: true, matricula_id, turma_id, alterada: false }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const { data, error } = await db.rpc("balcao_corrigir_turma_origem_pauta", {
      p_escola_id: escolaId, p_matricula_id: matricula_id, p_turma_destino_id: turma_id,
    });
    if (error || data?.ok !== true) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Não foi possível corrigir a turma da pauta." }, {
        status: error?.code === "42501" ? 403 : 409,
      });
    }
    return NextResponse.json({ ok: true, matricula_id, turma_id: data.turma_id, alterada: data.alterada }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[BALCAO-PAUTA-TURMA-POST]", err);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar a turma." }, { status: 500 });
  }
}
