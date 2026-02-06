import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const withNoStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }));
    }

    const { data: hasRole, error: rolesError } = await supabase.rpc("user_has_role_in_school", {
      p_escola_id: requestedEscolaId,
      p_roles: ["admin_escola", "admin", "secretaria"],
    });

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return withNoStore(NextResponse.json({ ok: false, error: "Erro ao verificar permissões." }, { status: 500 }));
    }

    if (!hasRole) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Você não tem permissão para executar esta ação." }, { status: 403 })
      );
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: "Acesso negado a esta escola." }, { status: 403 }));
    }

    const { data, error } = await supabase
      .from("escolas")
      .select("id, nome, nif, endereco, logo_url, cor_primaria")
      .eq("id", effectiveEscolaId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching escola identidade:", error);
      return withNoStore(NextResponse.json({ ok: false, error: "Erro ao carregar identidade." }, { status: 500 }));
    }

    return withNoStore(NextResponse.json({ ok: true, data }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error in identidade GET API:", message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
