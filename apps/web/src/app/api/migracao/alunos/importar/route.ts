import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/route-client";
import { importBelongsToEscola, userHasAccessToEscola } from "../../auth-helpers";

import type { Database } from "~types/supabase";
import type { ImportResult } from "~types/migracao";

export const dynamic = "force-dynamic";

interface ImportBody {
  importId: string;
  escolaId: string;
  anoLetivo: number;
}

export async function POST(request: Request) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }

  // Autentica usuário
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: ImportBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { importId, escolaId, anoLetivo } = body;
  if (!importId || !escolaId || !anoLetivo) {
    return NextResponse.json({ error: "importId, escolaId e anoLetivo são obrigatórios" }, { status: 400 });
  }

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

  // Verifica acesso e pertencimento do importId
  const hasAccess = await userHasAccessToEscola(supabase, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });
  const sameEscola = await importBelongsToEscola(supabase, importId, escolaId);
  if (!sameEscola) return NextResponse.json({ error: "Importação não pertence à escola" }, { status: 403 });

  const { data, error } = await supabase.rpc("importar_alunos", {
    p_import_id: importId,
    p_escola_id: escolaId,
    p_ano_letivo: Number(anoLetivo), // Vital!
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (Array.isArray(data) && data.length ? data[0] : data) as ImportResult;

  await supabase
    .from("import_migrations")
    .update({ status: "imported", processed_at: new Date().toISOString() })
    .eq("id", importId);

  return NextResponse.json({ result });
}
