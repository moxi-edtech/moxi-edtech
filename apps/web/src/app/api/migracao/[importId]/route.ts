import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { userHasAccessToEscola } from "../auth-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params;
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: im } = await routeClient
    .from("import_migrations")
    .select(
      "id, escola_id, file_name, status, total_rows, imported_rows, error_rows, processed_at, created_at"
    )
    .eq("id", importId)
    .maybeSingle();
  const escolaId = (im as any)?.escola_id as string | undefined;
  if (!escolaId || !im) {
    return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
  }

  const hasAccess = await userHasAccessToEscola(routeClient as any, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });

  return NextResponse.json({ ok: true, item: im });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params;
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nextFileName = typeof body?.file_name === "string" ? body.file_name.trim() : undefined;
  if (!nextFileName) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data: im } = await routeClient
    .from("import_migrations")
    .select("escola_id")
    .eq("id", importId)
    .maybeSingle();
  const escolaId = (im as any)?.escola_id as string | undefined;
  if (!escolaId) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  const hasAccess = await userHasAccessToEscola(routeClient as any, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });

  const { error } = await routeClient
    .from("import_migrations")
    .update({ file_name: nextFileName })
    .eq("id", importId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params;
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: im } = await routeClient
    .from("import_migrations")
    .select("escola_id, storage_path")
    .eq("id", importId)
    .maybeSingle();
  const escolaId = (im as any)?.escola_id as string | undefined;
  const storagePath = (im as any)?.storage_path as string | undefined;
  if (!escolaId) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  const hasAccess = await userHasAccessToEscola(routeClient as any, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });

  // Limpa erros e staging antes de remover a importação, e tenta remover o arquivo do storage
  try {
    await routeClient.from("import_errors").delete().eq("import_id", importId);
  } catch {}
  try {
    await routeClient.from("staging_alunos").delete().eq("import_id", importId);
  } catch {}
  try {
    if (storagePath) {
      await routeClient.storage.from("migracoes").remove([storagePath]);
    }
  } catch {}

  const { error } = await routeClient.from("import_migrations").delete().eq("id", importId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
