import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchProfessorNotificacao } from "@/lib/notificacoes/dispatchProfessorNotificacao";
import { dispatchAlunoNotificacao } from "@/lib/notificacoes/dispatchAlunoNotificacao";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  motivo: z.string().max(500).optional(),
  is_override_manual: z.boolean().default(false),
  status_override: z
    .enum(["TRANSFERIDO", "ANULADO", "REPROVADO_POR_FALTAS"])
    .optional(),
});

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;
const OVERRIDE_ROLES = ["admin", "admin_escola", "staff_admin"] as const;

export async function POST(
  request: Request,
  { params }: { params: { matriculaId: string } }
) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const matriculaId = params.matriculaId;
    const { data: matriculaData, error: matriculaError } = await supabase
      .from("matriculas")
      .select("escola_id")
      .eq("id", matriculaId)
      .single();

    if (matriculaError || !matriculaData?.escola_id) {
      return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
    }

    const escolaId = matriculaData.escola_id as string;
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const isOverride = parsed.data.is_override_manual;
    const overrideStatus = parsed.data.status_override;

    if (isOverride && !overrideStatus) {
      return NextResponse.json(
        { ok: false, error: "status_override é obrigatório quando is_override_manual=true" },
        { status: 400 }
      );
    }

    if (isOverride) {
      const { error: overrideAuthError } = await requireRoleInSchool({
        supabase,
        escolaId,
        roles: [...OVERRIDE_ROLES],
      });
      if (overrideAuthError) {
        return NextResponse.json(
          { ok: false, error: "Apenas Admin/Direção pode aplicar override manual" },
          { status: 403 }
        );
      }
    }

    try {
      await supabase.rpc("refresh_mv_boletim_por_matricula");
    } catch (err) {
      console.warn("[matriculas/finalizar] refresh_mv_boletim_por_matricula falhou", err);
    }

    const { data: result, error: rpcError } = await supabase.rpc("finalizar_matricula_blindada", {
      p_escola_id: escolaId,
      p_matricula_id: matriculaId,
      p_motivo: parsed.data.motivo ?? null,
      p_is_override_manual: isOverride,
      p_status_override: isOverride ? overrideStatus?.toLowerCase() ?? null : null,
    });

    if (rpcError) {
      if (rpcError.message.includes("Não é possível finalizar")) {
        return NextResponse.json({ ok: false, error: rpcError.message }, { status: 422 });
      }
      if (rpcError.message.includes("Conflito de concorrência")) {
        return NextResponse.json({ ok: false, error: rpcError.message }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    if (!result?.ok && result?.status === "incompleto") {
      return NextResponse.json({ ok: false, error: result.message, motivos: result.motivos }, { status: 422 });
    }

    if (result?.status === "ativo") {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const actorRole = (actorProfile as { role?: string | null } | null)?.role ?? null;

      const { data: matriculaDetalhe } = await supabase
        .from("matriculas")
        .select("id, turma_id, aluno_id, alunos(nome), turmas(nome)")
        .eq("id", matriculaId)
        .maybeSingle();

      const turmaId = (matriculaDetalhe as any)?.turma_id as string | null;
      const alunoId = (matriculaDetalhe as any)?.aluno_id as string | null;
      const alunoNome = (matriculaDetalhe as any)?.alunos?.nome ?? null;
      const turmaNome = (matriculaDetalhe as any)?.turmas?.nome ?? null;

      if (turmaId) {
        const { data: professoresTurma } = await supabase
          .from("turma_disciplinas")
          .select("professor_id")
          .eq("escola_id", escolaId)
          .eq("turma_id", turmaId);

        const professorIds = Array.from(
          new Set((professoresTurma ?? []).map((row: any) => row.professor_id).filter(Boolean))
        );

        if (professorIds.length > 0) {
          const { data: professorProfiles } = await supabase
            .from("professores")
            .select("profile_id")
            .in("id", professorIds)
            .eq("escola_id", escolaId);

          const recipientIds = Array.from(
            new Set(
              (professorProfiles ?? [])
                .map((row: any) => row.profile_id)
                .filter(Boolean)
            )
          ) as string[];

          if (recipientIds.length > 0) {
            await dispatchProfessorNotificacao({
              escolaId,
              key: "ALUNO_MATRICULADO",
              params: { alunoNome, turmaNome },
              recipientIds,
              actorId: user.id,
              actorRole: actorRole ?? "secretaria",
              agrupamentoTTLHoras: 6,
            });
          }
        }
      }

      if (alunoId) {
        await dispatchAlunoNotificacao({
          escolaId,
          key: "MATRICULA_CONFIRMADA",
          alunoIds: [alunoId],
          params: { alunoNome, actionUrl: "/aluno" },
          actorId: user.id,
          actorRole: actorRole ?? "secretaria",
          agrupamentoTTLHoras: 12,
        });
      }
    }

    return NextResponse.json({ ok: true, status: result?.status, origem: result?.status_fecho_origem });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
