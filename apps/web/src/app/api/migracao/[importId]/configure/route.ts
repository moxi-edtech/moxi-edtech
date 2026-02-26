import { createClient } from "~/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { importBelongsToEscola } from "../../auth-helpers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: any) {
  const { importId } = context.params;

  if (!importId) {
    return NextResponse.json(
      { error: "O ID da importação é obrigatório." },
      { status: 400 }
    );
  }

  const { cursos, turmas } = await request.json();

  if (!cursos && !turmas) {
    return NextResponse.json(
      { error: "Pelo menos um dos campos 'cursos' ou 'turmas' deve ser fornecido." },
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
      .rpc("update_import_configuration", {
        p_import_id: importId,
        p_cursos_data: cursos || [],
        p_turmas_data: turmas || [],
      })
      .single();

    if (error) {
      console.error(
        `[API MIGRAÇÃO CONFIGURE] Erro ao chamar RPC update_import_configuration:`,
        error
      );
      throw new Error(
        `Falha ao atualizar a configuração da importação: ${error.message}`
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Ocorreu um erro no servidor.",
      },
      { status: 500 }
    );
  }
}
