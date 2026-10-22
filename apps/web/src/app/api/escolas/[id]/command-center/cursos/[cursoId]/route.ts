import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope, AcademicYearContextError } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivoId: z.string().uuid().nullable(),
});

/** Read-only academic overview for the Command Center; financial permissions are separate. */
async function readExplorer(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cursoId: string }> },
) {
  const { id: requestedEscolaId, cursoId } = await params;
  const input = inputSchema.safeParse({
    cursoId,
    anoLetivoId: new URL(req.url).searchParams.get("ano_letivo_id"),
  });
  if (!input.success) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola sem acesso." }, { status: 403 });
    }

    // Explicit K12 role gate: mere membership must never authorise this data.
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      productContext: "k12",
      roles: [
        "admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro",
        "admin_financeiro",
      ],
    });
    if (authz.error) return authz.error;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId,
      requestedAcademicYearId: input.data.anoLetivoId,
      operation: "READ",
    });

    const { data, error } = await (supabase as any).rpc("command_center_course_overview", {
      p_escola_id: escolaId,
      p_curso_id: input.data.cursoId,
      p_ano_letivo_id: year.id,
    });

    if (error) {
      const unavailable = error.code === "PGRST202" || error.code === "42883";
      return NextResponse.json({
        ok: false,
        error: unavailable
          ? "A visão contextual ainda não está instalada neste ambiente."
          : "Não foi possível carregar os indicadores académicos.",
      }, { status: unavailable ? 503 : 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Curso não encontrado." }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Falha ao carregar curso." }, { status: 500 });
  }
}

/** Stable envelope and PII-free correlation across success, 4xx and 5xx. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> },
) {
  return withExplorerObservability("curso", () => readExplorer(req, context));
}
