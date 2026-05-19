import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entity, entity_id, reason, escolaId } = json;

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const realEscolaId = await resolveEscolaIdForUser(supabase, auth.user.id, escolaId);

    const { data, error } = await supabase.rpc("set_secretaria_priority", {
      p_escola_id: realEscolaId,
      p_entity: entity,
      p_entity_id: entity_id,
      p_reason: reason || null,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
