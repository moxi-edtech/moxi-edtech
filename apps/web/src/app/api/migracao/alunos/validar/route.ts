import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import type { Database } from "~types/supabase";
import type { AlunoStagingRecord, MappedColumns } from "~types/migracao";
import { csvToJsonLines, mapAlunoFromCsv, summarizePreview } from "../../utils";

export const dynamic = "force-dynamic";

interface ValidateBody {
  importId: string;
  escolaId: string;
  columnMap: MappedColumns;
}

export async function POST(request: Request) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }

  let body: ValidateBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { importId, escolaId, columnMap } = body;
  if (!importId || !escolaId) {
    return NextResponse.json({ error: "importId e escolaId são obrigatórios" }, { status: 400 });
  }

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

  const { data: migration, error: migrationError } = await supabase
    .from("import_migrations")
    .select("storage_path")
    .eq("id", importId)
    .single();

  if (migrationError || !migration) {
    return NextResponse.json({ error: migrationError?.message || "Importação não encontrada" }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("migracoes")
    .download(migration.storage_path!);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: downloadError?.message || "Arquivo não encontrado" }, { status: 404 });
  }

  const text = await fileData.text();
  const entries = csvToJsonLines(text);
  const staged: AlunoStagingRecord[] = entries.map((entry) => mapAlunoFromCsv(entry, columnMap, importId, escolaId));

  // Clear previous staging/errors for idempotency
  await supabase.from("import_errors").delete().eq("import_id", importId);
  await supabase.from("staging_alunos").delete().eq("import_id", importId);

  const { error: stageError } = await supabase.from("staging_alunos").upsert(staged);
  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 });
  }

  await supabase
    .from("import_migrations")
    .update({ status: "validado", total_rows: staged.length, column_map: columnMap })
    .eq("id", importId);

  return NextResponse.json({ preview: summarizePreview(staged), total: staged.length });
}
