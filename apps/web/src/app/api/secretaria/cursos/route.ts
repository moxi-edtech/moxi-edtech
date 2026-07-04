import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped();
    
    // 1. Auth & Escola
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [
        "secretaria",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
      ],
    });
    if (authz.error) {
      return authz.error;
    }

    // 2. Query Ajustada (SEM 'sigla', COM 'course_code')
    let query = supabase
      .from('cursos')
      .select('id, nome, codigo, course_code, curriculum_key') // <--- AQUI ESTAVA O ERRO
      .eq('escola_id', escolaId)
      .order('nome');

    query = applyKf2ListInvariants(query);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, data });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
