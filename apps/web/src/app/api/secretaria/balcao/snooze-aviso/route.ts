import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { aviso_id, aviso_type, days, custom_date, escolaId } = json;

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const realEscolaId = await resolveEscolaIdForUser(supabase, auth.user.id, escolaId);
    if (!realEscolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }
    const authz = await requireRoleInSchool({
      supabase,
      escolaId: realEscolaId,
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

    const { data, error } = await supabase.rpc("snooze_secretaria_aviso", {
      p_escola_id: realEscolaId,
      p_aviso_id: String(aviso_id),
      p_aviso_type: String(aviso_type),
      p_days: days || null,
      p_custom_date: custom_date || null,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
