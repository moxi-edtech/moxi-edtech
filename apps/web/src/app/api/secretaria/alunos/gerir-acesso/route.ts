import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { assertPortalAccess } from "@/lib/portalAccess";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { requireRoleInSchool } from "@/lib/authz";

export async function POST(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const portalCheck = await assertPortalAccess(s as any, user.id, "secretaria");
    if (!portalCheck.ok) {
      return NextResponse.json({ ok: false, error: portalCheck.error }, { status: portalCheck.status });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const alunoIds = Array.isArray(body?.alunoIds) ? (body.alunoIds.filter(Boolean) as string[]) : [];
    const motivo = body?.motivo || null;
    const escolaIdParam = body?.escolaId || null;

    if (alunoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Informe os alunos" }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(s as any, user.id, escolaIdParam);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const { error: roleError } = await requireRoleInSchool({
      supabase: s as any,
      escolaId,
      roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    const resultados: Array<{ id: string; status: string; data?: any; error?: string }> = [];
    if (action === "bloquear") {
      const { error } = await s
        .from("alunos")
        .update({
          acesso_bloqueado: true,
          motivo_bloqueio: motivo || "Bloqueio manual via secretaria",
          bloqueado_em: new Date().toISOString(),
          bloqueado_por: user.id,
        })
        .in("id", alunoIds)
        .eq("escola_id", escolaId);
      if (error) throw error;
    } else if (action === "restaurar") {
      // Remover flag de bloqueio manual
      const { error } = await s
        .from("alunos")
        .update({
          acesso_bloqueado: false,
          motivo_bloqueio: null,
          bloqueado_em: null,
          bloqueado_por: null,
        })
        .in("id", alunoIds)
        .eq("escola_id", escolaId);
      if (error) throw error;
      
      // Se algum estiver suspenso, restaurar para ativo
      await s
        .from("alunos")
        .update({ status: "ativo" })
        .in("id", alunoIds)
        .eq("escola_id", escolaId)
        .eq("status", "suspenso");

    } else if (action === "reset-senha") {
      const { data: alunos } = await s
        .from("alunos")
        .select("id, profile_id, usuario_auth_id")
        .in("id", alunoIds)
        .eq("escola_id", escolaId);
      
      if (!alunos) throw new Error("Alunos não encontrados");

      for (const aluno of alunos) {
        const userId = aluno.usuario_auth_id || aluno.profile_id || null;
        if (!userId) {
          resultados.push({ id: aluno.id, status: "error", error: "Aluno sem acesso ativo" });
          continue;
        }
        try {
          const res = await callAuthAdminJob(req, "resetStudentPassword", {
            userId,
          });
          resultados.push({ id: aluno.id, status: "success", data: res });
        } catch (err: any) {
          resultados.push({ id: aluno.id, status: "error", error: err.message });
        }
      }
      const falhas = resultados.filter((resultado) => resultado.status === "error");
      return NextResponse.json(
        { ok: falhas.length === 0, resultados, error: falhas[0]?.error },
        { status: falhas.length > 0 ? 400 : 200 }
      );
    } else {
      return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
