// @kf2 allow-scan
import { createClient } from "~/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { importBelongsToEscola } from "../../auth-helpers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { importId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  const { importId } = await params;

  if (!importId) {
    return NextResponse.json(
      { error: "O ID da importação é obrigatório." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });
  }

  const sameEscola = await importBelongsToEscola(supabase as any, importId, escolaId);
  if (!sameEscola) {
    return NextResponse.json({ error: "Importação não pertence à escola" }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .rpc("get_import_summary", { p_import_id: importId })
      .single();

    if (error) {
      console.error(
        `[API MIGRAÇÃO SUMMARY] Erro ao chamar RPC get_import_summary:`,
        error
      );
      return NextResponse.json(
        { error: `Falha ao buscar o resumo da importação: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? { cursos: [], turmas: [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Ocorreu um erro no servidor." },
      { status: 500 }
    );
  }
}
