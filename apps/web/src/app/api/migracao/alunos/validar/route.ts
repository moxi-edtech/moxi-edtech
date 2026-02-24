import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { importBelongsToEscola, userHasAccessToEscola } from "../../auth-helpers";

import type { Database } from "~types/supabase";
import type { AlunoStagingRecord, MappedColumns } from "~types/migracao";
import { csvToJsonLines, fileToCsvText, mapAlunoFromCsv, summarizePreview } from "../../utils";

const UPSERT_BATCH_SIZE = 500;

export const dynamic = "force-dynamic";

interface ValidateBody {
  importId: string;
  escolaId: string;
  columnMap: MappedColumns;
  anoLetivo: number; // NOVO: Ano letivo para validação e importação
}

export async function POST(request: Request) {
  // Autentica usuário
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: ValidateBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { importId, escolaId, columnMap, anoLetivo } = body;
  if (!importId || !escolaId || !anoLetivo) {
    return NextResponse.json({ error: "importId, escolaId e anoLetivo são obrigatórios" }, { status: 400 });
  }

  try {
    const supabase = routeClient as any;

    // Verifica acesso e consistência do importId/escolaId
    const hasAccess = await userHasAccessToEscola(supabase, escolaId, authUser.id);
    if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });
    const sameEscola = await importBelongsToEscola(supabase, importId, escolaId);
    if (!sameEscola) return NextResponse.json({ error: "Importação não pertence à escola" }, { status: 403 });

    const { data: migration, error: migrationError } = await supabase
      .from("import_migrations")
      .select("storage_path, file_name")
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

    const text = await fileToCsvText(fileData as Blob, {
      fileName: migration.file_name || migration.storage_path || undefined,
      mimeType: (fileData as any).type,
    });
    const entries = csvToJsonLines(text);
    const mappedStaged: AlunoStagingRecord[] = entries.map((entry, index) =>
      mapAlunoFromCsv(entry, columnMap, importId, escolaId, anoLetivo, index + 2)
    );

    // Filter out effectively empty rows after mapping
    const staged = mappedStaged.filter(
      (record) =>
        record.nome ||
        record.bi_numero ||
        record.encarregado_nome ||
        record.turma_codigo
    );

    if (!staged.length) {
      return NextResponse.json({ error: "Nenhuma linha encontrada no arquivo" }, { status: 400 });
    }

    // Descobre suporte a coluna row_number (nem todos os ambientes migraram ainda)
    const { data: stagingColumns } = await supabase
      .from("information_schema.columns" as any)
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "staging_alunos")
      .eq("column_name", "row_number");

    const supportsRowNumber = (stagingColumns?.length ?? 0) > 0;
    const stagedForUpsert = supportsRowNumber
      ? staged
      : staged.map(({ row_number: _rn, ...rest }) => rest);

    // Clear previous staging/errors for idempotency
    await supabase.from("import_errors").delete().eq("import_id", importId);
    await supabase.from("staging_alunos").delete().eq("import_id", importId);

    for (let i = 0; i < stagedForUpsert.length; i += UPSERT_BATCH_SIZE) {
      const chunk = stagedForUpsert.slice(i, i + UPSERT_BATCH_SIZE);
      const { error: stageError } = await supabase.from("staging_alunos").upsert(chunk);
      if (stageError) {
        const rangeEnd = Math.min(staged.length, i + UPSERT_BATCH_SIZE);
        return NextResponse.json(
          { error: `Falha ao salvar linhas ${i + 1}-${rangeEnd}: ${stageError.message}` },
          { status: 500 }
        );
      }
    }

    await supabase
      .from("import_migrations")
      .update({ status: "validado", total_rows: staged.length, column_map: columnMap })
      .eq("id", importId);

    return NextResponse.json({ preview: summarizePreview(staged), total: staged.length });
  } catch (error) {
    console.error("[migracao][alunos][validar] erro inesperado", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
