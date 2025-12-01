import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";

// DELETE OU POST (estamos usando POST na UI)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const alunoId = id;
    if (!alunoId) {
      return NextResponse.json(
        { ok: false, error: "ID do aluno não fornecido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason: string =
      (body?.reason as string | undefined)?.trim() ||
      "Aluno arquivado pela secretaria";

    // 1) Usuário logado (cliente normal, com RLS)
    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    // 2) Pega perfil e contexto de escola + papel
    const { data: prof, error: profErr } = await s
      .from("profiles")
      .select("role, escola_id, current_escola_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json(
        { ok: false, error: profErr.message },
        { status: 400 }
      );
    }

    const role = (prof as any)?.role as string | undefined;
    const escolaFromProfile =
      (prof as any)?.current_escola_id || (prof as any)?.escola_id || null;

    // 3) Autorização de papel
    const allowedRoles = [
      "super_admin",
      "global_admin",
      "admin",
      "secretaria",
      "financeiro",
    ];

    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
      );
    }

    if (!escolaFromProfile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não está vinculado a uma escola" },
        { status: 403 }
      );
    }

    // 4) Carrega o aluno via cliente normal (RLS garante escopo)
    const { data: aluno, error: alunoErr } = await s
      .from("alunos")
      .select(
        "id, nome, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, deleted_at, deleted_by, deletion_reason"
      )
      .eq("id", alunoId)
      .maybeSingle();

    if (alunoErr) {
      return NextResponse.json(
        { ok: false, error: alunoErr.message },
        { status: 400 }
      );
    }
    if (!aluno) {
      return NextResponse.json(
        { ok: false, error: "Aluno não encontrado" },
        { status: 404 }
      );
    }

    // 5) Garante que o aluno pertence à mesma escola do usuário
    const alunoEscolaId = (aluno as any).escola_id as string | null;
    if (!alunoEscolaId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Aluno sem escola definida (escola_id nulo). Não é possível arquivar com segurança.",
        },
        { status: 400 }
      );
    }

    if (String(alunoEscolaId) !== String(escolaFromProfile)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Aluno não pertence à escola ativa do usuário",
        },
        { status: 403 }
      );
    }

    // 6) Usa service role para escrever em alunos / alunos_excluidos ignorando RLS
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!adminUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: falta SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }
    const admin = createAdminClient<Database>(adminUrl, serviceRole);

    // 7) Atualiza aluno -> soft delete (marca deleted_at, deleted_by e reason)
    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("alunos")
      .update({
        deleted_at: now,
        deleted_by: user.id,
        deletion_reason: reason,
        status: 'arquivado' as any,
      } as Database["public"]["Tables"]["alunos"]["Update"])
      .eq("id", alunoId);

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 400 }
      );
    }

    // 8) Cria/atualiza registro em alunos_excluidos (histórico)
    try {
      await admin.from("alunos_excluidos").insert({
        aluno_id: (aluno as any).id,
        escola_id: (aluno as any).escola_id,
        profile_id: (aluno as any).profile_id,
        nome: (aluno as any).nome ?? null,
        exclusao_motivo: reason,
        aluno_created_at: (aluno as any).created_at ?? null,
        aluno_deleted_at: now,
        excluido_por: user.id,
        dados_anonimizados: false,
        snapshot: { aluno, captured_at: now } as any,
      } as Database["public"]["Tables"]["alunos_excluidos"]["Insert"]);
    } catch (e) {
      // Não bloqueia a operação principal
      console.warn("[alunos.delete] Falha ao inserir em alunos_excluidos", e);
    }

    // 9) Auditoria
    try {
      await recordAuditServer({
        escolaId: (aluno as any).escola_id,
        portal: 'secretaria',
        acao: 'ALUNO_ARQUIVADO',
        entity: 'aluno',
        entityId: String(alunoId),
        details: { performed_by: user.id, role }
      })
    } catch {}

    return NextResponse.json({ ok: true, mode: "soft" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[alunos.delete] Erro inesperado:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return POST(req, ctx);
}

