import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/route-client";
import { randomUUID } from "node:crypto";

import type { Database } from "~types/supabase";
import type { ImportStatus } from "~types/migracao";
import { hashBuffer, MAX_UPLOAD_SIZE } from "../utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }

  // Autentica e determina o usuário pelo token (ignorar userId vindo do cliente)
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const escolaId = formData.get("escolaId")?.toString();
  const createdBy = authUser.id;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
  }

  if (!escolaId) {
    return NextResponse.json({ error: "escolaId obrigatório" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que o limite permitido" }, { status: 400 });
  }

  const nameLower = file.name.toLowerCase();
  const contentType = file.type || "";
  const isXlsx =
    nameLower.endsWith(".xlsx") ||
    contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const isCsv =
    nameLower.endsWith(".csv") ||
    contentType === "text/csv" ||
    contentType === "application/vnd.ms-excel";

  if (!isCsv && !isXlsx) {
    return NextResponse.json({ error: "Formato não suportado. Envie CSV ou XLSX." }, { status: 400 });
  }

  const hash = hashBuffer(buffer);
  const importId = randomUUID();
  const objectPath = `migracoes/${importId}/${file.name}`;

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

  // Verifica vínculo do usuário com a escola informada
  try {
    const { data: vinc } = await supabase
      .from("escola_users")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", createdBy)
      .limit(1);
    let hasAccess = !!(vinc && vinc.length > 0);
    if (!hasAccess) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", createdBy)
        .or(`current_escola_id.eq.${escolaId},escola_id.eq.${escolaId}`)
        .limit(1);
      hasAccess = !!(prof && prof.length > 0);
    }
    if (!hasAccess) {
      return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Ensure bucket exists
  try {
    const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket("migracoes");
    if (bucketError || !bucketInfo) {
      await supabase.storage.createBucket("migracoes", { public: false });
    }
  } catch (err) {
    console.warn("[upload] bucket check failed", err);
  }

  const { error: uploadError } = await supabase.storage.from("migracoes").upload(objectPath, buffer, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "text/csv",
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const status: ImportStatus = "uploaded";
  const { error: dbError } = await supabase.from("import_migrations").insert({
    id: importId,
    escola_id: escolaId,
    created_by: createdBy,
    file_name: file.name,
    file_hash: hash,
    storage_path: objectPath,
    status,
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ importId, status, objectPath, hash });
}
