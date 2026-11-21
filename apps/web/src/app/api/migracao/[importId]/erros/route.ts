import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveAuthorizedImportSchool } from "../../import-school-context";

export async function GET(request: Request, { params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  if (!z.string().uuid().safeParse(importId).success) {
    return NextResponse.json({ error: "Importação inválida." }, { status: 400 });
  }
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const scope = await resolveAuthorizedImportSchool(supabase as any, request, auth.user.id);
  if (scope.error) return scope.error;
  const { data: item, error: lookupError } = await supabase
    .from("import_migrations")
    .select("id")
    .eq("id", importId)
    .eq("escola_id", scope.escolaId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Não foi possível consultar a importação." }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Importação não encontrada nesta escola." }, { status: 404 });

  const { data, error } = await supabase
    .from("import_errors")
    .select("row_number,column_name,message,raw_value")
    .eq("import_id", importId)
    .order("row_number", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os erros." }, { status: 500 });
  return NextResponse.json({ errors: data ?? [] });
}
