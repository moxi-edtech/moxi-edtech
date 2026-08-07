import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  AcademicYearContextError,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const requested = new URL(req.url).searchParams.get("ano_letivo_id");
    const context = await resolveAcademicYearContext(supabase as any, {
      userId: data.user.id,
      requestedAcademicYearId: requested,
      operation: "READ",
    });

    return NextResponse.json({ ok: true, context });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: "Erro ao resolver o contexto académico" }, { status: 500 });
  }
}
