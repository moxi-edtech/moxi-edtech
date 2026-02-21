import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../permissions";
import { CURRICULUM_PRESETS, type CurriculumKey } from "@/lib/academico/curriculum-presets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  const url = new URL(req.url);
  const cursoId = url.searchParams.get("curso_id") || url.searchParams.get("cursoId");
  if (!cursoId) {
    return NextResponse.json({ ok: false, error: "curso_id obrigatório" }, { status: 400 });
  }

  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  }

  const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

  const { data: cursoRow } = await (supabase as any)
    .from("cursos")
    .select("id, curriculum_key")
    .eq("escola_id", escolaId)
    .eq("id", cursoId)
    .maybeSingle();

  const curriculumKey = cursoRow?.curriculum_key as CurriculumKey | null;
  if (!curriculumKey) {
    return NextResponse.json({ ok: true, source: "none", items: [] });
  }

  try {
    const { data: presetRows, error: presetErr } = await (supabase as any)
      .from("curriculum_preset_subjects")
      .select("id, preset_id, name, grade_level, component, weekly_hours")
      .eq("preset_id", curriculumKey);

    if (presetErr) throw presetErr;

    const presetIds = (presetRows || []).map((row: any) => row.id).filter(Boolean);
    let schoolMap = new Map<string, any>();
    if (presetIds.length > 0) {
      const { data: schoolRows } = await (supabase as any)
        .from("school_subjects")
        .select("preset_subject_id, custom_weekly_hours, custom_name, is_active")
        .eq("escola_id", escolaId)
        .in("preset_subject_id", presetIds);
      schoolMap = new Map((schoolRows || []).map((row: any) => [row.preset_subject_id, row]));
    }

    const items = (presetRows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      grade_level: row.grade_level,
      component: row.component,
      weekly_hours: row.weekly_hours,
      school: schoolMap.get(row.id) ?? null,
    }));

    return NextResponse.json({ ok: true, source: "db", items });
  } catch (error: any) {
    const code = error?.code as string | undefined;
    const message = error?.message as string | undefined;
    const isMissingTable = code === "42P01" || (message && /does not exist/i.test(message));
    if (!isMissingTable) {
      return NextResponse.json({ ok: false, error: message || "Falha ao carregar presets" }, { status: 400 });
    }

    const preset = CURRICULUM_PRESETS[curriculumKey] ?? [];
    const items = preset.map((disc) => ({
      id: null,
      name: disc.nome,
      grade_level: disc.classe,
      component: disc.componente,
      weekly_hours: disc.horas,
      school: null,
    }));
    return NextResponse.json({ ok: true, source: "preset", items });
  }
}
