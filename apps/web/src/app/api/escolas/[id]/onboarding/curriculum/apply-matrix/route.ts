import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

import { removeAccents } from "@/lib/turma";

// Helpers
const normalizeNome = (nome: string): string =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

const mapCourseTypeToNivel = (tipo: string): string => {
  switch (tipo) {
    case "primario": return "base";
    case "ciclo1": return "secundario1";
    case "puniv": return "secundario2";
    case "tecnico":
    case "tecnico_ind":
    case "tecnico_serv":
      return "tecnico";
    case "geral":
    default: return "geral"; // fallback seguro
  }
};

const normalizeTurno = (turno: string): "M" | "T" | "N" | null => {
  const key = removeAccents(turno || "").toUpperCase();
  const SHIFT_MAP: Record<string, "M" | "T" | "N"> = {
    MANHA: "M", MATUTINO: "M", M: "M",
    TARDE: "T", VESPERTINO: "T", T: "T",
    NOITE: "N", NOTURNO: "N", N: "N",
  };
  return SHIFT_MAP[key] ?? null;
};

// Schema
const matrixSchema = z.object({
  sessionId: z.string(),
  matrix: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      manha: z.number(),
      tarde: z.number(),
      noite: z.number(),
      cursoKey: z.string(),
      cursoTipo: z.string().optional(),
      cursoNome: z.string().optional(),
      // This allows the frontend to send custom course data, including which preset it's based on
      customData: z.object({
        associatedPreset: z.string()
      }).optional(),
    })
  ),
});

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: ["admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    const json = await req.json();
    const parsed = matrixSchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos.", issues: parsed.error.issues }, { status: 400 });
    }

    const { sessionId, matrix } = parsed.data;

    const { data: summary, error } = await (supabase as any).rpc('onboard_academic_structure_from_matrix', {
      p_escola_id: escolaId,
      p_session_id: sessionId,
      p_matrix: matrix,
    });

    if (error) {
      console.error("Error calling onboard_academic_structure_from_matrix RPC:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    recordAuditServer({
      escolaId,
      portal: "admin_escola",
      acao: "CURRICULO_MATRIX_APLICADA",
      entity: "curriculo",
      details: {
        sessionId,
        linhas: matrix.length,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      summary,
      message: "Estrutura aplicada com sucesso."
    });

  } catch (e: any) {
    console.error("Fatal Error in apply-matrix API route:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
