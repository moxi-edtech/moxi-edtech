import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { fetchAcademicCarryovers } from "@/lib/academico/dependencias-transicao-server";
import type { AcademicCarryoverStatus } from "@/lib/academico/dependencias-transicao";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  aluno_id: z.string().uuid().optional(),
  status: z.enum([
    "pendente",
    "em_recurso",
    "resolvida_aprovada",
    "resolvida_reprovada",
    "cancelada",
  ]).optional(),
});

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

  const authz = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["admin", "admin_escola", "staff_admin", "admin_secretaria", "diretor", "secretaria"],
  });
  if (authz.error) return authz.error;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Filtros inválidos" }, { status: 400 });
  }

  try {
    const statuses = parsed.data.status
      ? [parsed.data.status as AcademicCarryoverStatus]
      : undefined;
    const items = await fetchAcademicCarryovers(supabase as any, {
      escolaId,
      alunoId: parsed.data.aluno_id,
      statuses,
      limit: 200,
    });

    const alunoIds = [...new Set(items.map((item) => item.aluno_id))];
    const { data: alunos } = alunoIds.length
      ? await supabase
          .from("alunos")
          .select("id, nome, nome_completo, numero_processo")
          .eq("escola_id", escolaId)
          .in("id", alunoIds)
      : { data: [] };
    const alunoById = new Map((alunos ?? []).map((aluno: any) => [aluno.id, aluno]));

    return NextResponse.json({
      ok: true,
      summary: {
        total: items.length,
        abertas: items.filter((item) =>
          item.status === "pendente"
          || item.status === "em_recurso"
          || item.status === "resolvida_reprovada"
        ).length,
        resolvidas: items.filter((item) => item.status === "resolvida_aprovada").length,
      },
      items: items.map((item) => ({
        ...item,
        aluno: (() => {
          const aluno = alunoById.get(item.aluno_id) as any;
          return {
            id: item.aluno_id,
            nome: aluno?.nome_completo ?? aluno?.nome ?? "Aluno",
            numero_processo: aluno?.numero_processo ?? null,
          };
        })(),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível carregar a fila de dependências.",
    }, { status: 500 });
  }
}
