import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeMatriculasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();

    // 1. Autenticação
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user)
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // 2. Resolve a escola do usuário
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);

    if (!escolaId)
      return NextResponse.json(
        { ok: false, error: "Perfil sem escola vinculada" },
        { status: 403 }
      );

    const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/matriculas>; rel="successor-version"`);

    // 3. Admin client para chamar RPC segura
    // 4. Chama RPC de prévia
    let rpcQuery = supabase.rpc("preview_next_matricula_number", {
      p_escola_id: escolaId
    });

    rpcQuery = applyKf2ListInvariants(rpcQuery, { defaultLimit: 1 });

    const { data, error } = await rpcQuery;

    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });

    const numeroRaw = data as number | string | null;
    const numero = numeroRaw === null || numeroRaw === undefined ? null : Number(numeroRaw);

    return NextResponse.json({ ok: true, numero }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
