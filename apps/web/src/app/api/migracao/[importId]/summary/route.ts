import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { importId: string } }
) {
  const { importId } = params;

  if (!importId) {
    return NextResponse.json(
      { error: "O ID da importação é obrigatório." },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    const { data, error } = await supabase
      .rpc("get_import_summary", {
        p_import_id: importId,
      })
      .single();

    if (error) {
      console.error(
        `[API MIGRAÇÃO SUMMARY] Erro ao chamar RPC get_import_summary:`,
        error
      );
      throw new Error(
        `Falha ao buscar o resumo da importação: ${error.message}`
      );
    }

    if (!data) {
      return NextResponse.json(
        { cursos: [], turmas: [] },
        { status: 200 }
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
