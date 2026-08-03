import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditServer } from "@/lib/audit";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { previewNotaImport } from "@/lib/virada/notas-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  ano_letivo: z.number().int().min(2000).max(2200),
  origem: z.enum(["PLANILHA", "MANUAL", "API"]),
  rows: z.array(z.unknown()).min(1).max(5_000),
});

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key obrigatório (8–200 caracteres)." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

  const authz = await authorizeEscolaAction(supabase, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
  }

  const preview = previewNotaImport(parsed.data.rows);
  const checksum = createHash("sha256").update(JSON.stringify(parsed.data.rows)).digest("hex");

  const { data: existing } = await supabase
    .from("virada_importacoes")
    .select("id, status, checksum, resumo")
    .eq("escola_id", escolaId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    if (existing.checksum !== checksum) {
      return NextResponse.json({ ok: false, error: "Idempotency-Key já usada com conteúdo diferente." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, reused: true, importacao: existing });
  }

  const resumo = {
    total: preview.total,
    validas: preview.validas.length,
    rejeitadas: preview.rejeitadas.length,
    duplicadas: preview.duplicadas.length,
  };
  const status = preview.rejeitadas.length === 0 && preview.duplicadas.length === 0 ? "VALIDADO" : "RASCUNHO";

  const { data: batch, error: batchError } = await supabase
    .from("virada_importacoes")
    .insert({
      escola_id: escolaId,
      ano_letivo_origem: parsed.data.ano_letivo,
      origem: parsed.data.origem,
      status,
      idempotency_key: idempotencyKey,
      checksum,
      resumo,
      criado_por: user.id,
    })
    .select("id, status, checksum, resumo")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ ok: false, error: batchError?.message || "Falha ao criar lote." }, { status: 400 });
  }

  const rejectedByLine = new Map(preview.rejeitadas.map((row) => [row.linha, row]));
  const duplicateByLine = new Map(preview.duplicadas.map((row) => [row.linha, row]));
  const validByLine = new Map(preview.validas.map((row) => [row.linha, row]));
  const lines = parsed.data.rows.map((raw, index) => {
    const linha = index + 2;
    const rejected = rejectedByLine.get(linha);
    const duplicate = duplicateByLine.get(linha);
    const valid = validByLine.get(linha);
    return {
      importacao_id: batch.id,
      escola_id: escolaId,
      linha,
      status: rejected ? "REJEITADA" : duplicate ? "DUPLICADA" : "VALIDA",
      chave: valid?.chave ?? duplicate?.chave ?? null,
      raw_data: raw,
      normalized_data: valid ?? null,
      erros: rejected?.erros ?? [],
    };
  });

  const { error: linesError } = await supabase.from("virada_importacao_linhas").insert(lines);
  if (linesError) {
    return NextResponse.json({ ok: false, error: linesError.message, importacao_id: batch.id }, { status: 400 });
  }

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "VIRADA_NOTAS_STAGE",
    entity: "virada_importacoes",
    entityId: batch.id,
    details: { origem: parsed.data.origem, ano_letivo: parsed.data.ano_letivo, ...resumo },
  }).catch(() => null);

  return NextResponse.json({ ok: true, reused: false, importacao: batch });
}
