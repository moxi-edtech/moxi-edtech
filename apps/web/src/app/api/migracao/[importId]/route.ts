import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveAuthorizedImportSchool } from "../import-school-context";

type Params = { params: Promise<{ importId: string }> };
const importIdSchema = z.string().uuid();

/** The selected school is checked before querying, editing or removing a row. */
async function context(request: Request, params: Params) {
  const { importId } = await params.params;
  if (!importIdSchema.safeParse(importId).success) {
    return { error: NextResponse.json({ error: "Importação inválida." }, { status: 400 }) } as const;
  }
  const client = await createRouteClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) } as const;
  }
  const scope = await resolveAuthorizedImportSchool(client as any, request, auth.user.id);
  if (scope.error) return { error: scope.error } as const;
  return { client, importId, escolaId: scope.escolaId, error: null } as const;
}

export async function GET(request: Request, params: Params) {
  const scope = await context(request, params);
  if (scope.error) return scope.error;
  const { data: item, error } = await scope.client
    .from("import_migrations")
    .select("id,escola_id,file_name,status,total_rows,imported_rows,error_rows,processed_at,created_at")
    .eq("id", scope.importId)
    .eq("escola_id", scope.escolaId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível consultar a importação." }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(request: Request, params: Params) {
  const scope = await context(request, params);
  if (scope.error) return scope.error;
  const body = await request.json().catch(() => null);
  const name = typeof body?.file_name === "string" ? body.file_name.trim() : "";
  if (!name || name.length > 255) {
    return NextResponse.json({ error: "Indique um nome válido (até 255 caracteres)." }, { status: 400 });
  }
  const { data: changed, error } = await scope.client
    .from("import_migrations")
    .update({ file_name: name })
    .eq("id", scope.importId)
    .eq("escola_id", scope.escolaId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível renomear a importação." }, { status: 400 });
  if (!changed) return NextResponse.json({ error: "Importação não encontrada nesta escola." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, params: Params) {
  const scope = await context(request, params);
  if (scope.error) return scope.error;

  const { data: item, error: lookupError } = await scope.client
    .from("import_migrations")
    .select("id,storage_path")
    .eq("id", scope.importId)
    .eq("escola_id", scope.escolaId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Não foi possível consultar a importação." }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Importação não encontrada nesta escola." }, { status: 404 });

  // Existing lifecycle: delete staging/errors before the parent. The import
  // was already verified to belong to the requested, authorized school.
  try {
    await scope.client.from("import_errors").delete().eq("import_id", scope.importId);
  } catch {}
  try {
    await scope.client.from("staging_alunos").delete().eq("import_id", scope.importId);
  } catch {}
  try {
    if (item.storage_path) await scope.client.storage.from("migracoes").remove([item.storage_path]);
  } catch {}

  const { data: deleted, error } = await scope.client
    .from("import_migrations")
    .delete()
    .eq("id", scope.importId)
    .eq("escola_id", scope.escolaId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível eliminar a importação." }, { status: 400 });
  if (!deleted) return NextResponse.json({ error: "A importação já não está disponível." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
