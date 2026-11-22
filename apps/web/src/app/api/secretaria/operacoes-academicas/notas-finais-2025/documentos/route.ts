import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURTUME = "3744879f-2e19-4671-8995-78604302d8c5";
const ROLES = new Set([
  "diretor", "admin", "admin_escola", "admin_secretaria",
  "admin_secretario", "admin_financeiro", "secretaria",
]);
const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

const DocumentLine = z.object({
  nome: z.string().max(250), numero_processo: z.string().nullable(),
  turma: z.string().nullable(), disciplina: z.string().nullable(),
  nota: z.number(), linha: z.string().nullable(), conferida: z.boolean(),
});
const DocumentGroup = z.object({
  arquivo: z.string().min(8).max(180), linhas: z.number().int().min(1).max(200),
  alunos: z.number().int().min(1).max(200),
  conferidas: z.number().int().min(0).max(200),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  detalhes: z.array(DocumentLine).max(200),
});
const Preview = z.object({
  ok: z.literal(true), ano: z.literal(2025),
  documentos: z.array(DocumentGroup).max(20),
});
const Review = z.object({
  acao: z.literal("conferir_pauta"), escola: z.string().min(1).max(150),
  arquivo: z.string().min(8).max(180),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  referencia: z.string().trim().min(8).max(180),
  motivo: z.string().trim().min(12).max(500),
  confirmacao: z.literal("CONFIRMO_PAUTA_2025_2026"),
}).strict();
const Sync = z.object({
  acao: z.literal("sincronizar_notas"), escola: z.string().min(1).max(150),
  limite: z.number().int().min(1).max(100).default(80),
}).strict();
const Input = z.discriminatedUnion("acao", [Review, Sync]);

type DataError = { code?: string | null; message?: string | null };
type RPCResult = { data: unknown; error: DataError | null };
type DatabaseRPC = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RPCResult>;
};

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

async function context(requestedSchool: string) {
  const db = await supabaseServerTyped<Database>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    return { db, escolaId: null, response: respond({ ok: false, error: "Sessão inválida." }, 401) };
  }
  // Explicit requested school is mandatory. A default tenant can be a different school.
  const escolaId = await resolveEscolaIdForUser(db, user.id, requestedSchool);
  if (escolaId !== CURTUME) {
    return { db, escolaId: null, response: respond({ ok: false, error: "Operação indisponível nesta escola." }, 403) };
  }
  const { data: membership, error } = await db.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
  if (error || !ROLES.has(String(membership?.papel ?? ""))) {
    return { db, escolaId: null, response: respond({ ok: false, error: "Sem permissão académica nesta escola." }, 403) };
  }
  return { db, escolaId, response: null };
}

function failure(error: DataError | null) {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  // Safe transition: main may deploy before the new, versioned SQL migration.
  // Absence of the RPC is not an excuse to create an alternate notes writer.
  if (code === "PGRST202" || code === "42883") {
    return respond({ ok: false, feature_unavailable: true }, 424);
  }
  if (code === "42501") return respond({ ok: false, error: "Sem permissão para validar esta pauta." }, 403);
  if (/DOCUMENTO_2025_ALTERADO_RECONSULTAR/.test(message)) {
    return respond({ ok: false, error: "A pauta foi alterada. Atualize a lista antes de confirmar." }, 409);
  }
  if (code === "23514" || code === "22023") {
    return respond({ ok: false, error: "A validação documental não passou. Confira a pauta, a referência e os alunos abrangidos." }, 409);
  }
  return respond({ ok: false, error: "Não foi possível concluir a operação. Os registos anteriores permanecem preservados." }, 503);
}

export async function GET(request: Request) {
  const escola = new URL(request.url).searchParams.get("escola")?.trim() ?? "";
  if (!escola || escola.length > 150) return respond({ ok: false, error: "Escola inválida." }, 400);
  try {
    const ctx = await context(escola);
    if (ctx.response) return ctx.response;
    const { data, error } = await (ctx.db as unknown as DatabaseRPC)
      .rpc("curtume_2025_documentos_pendentes", { p_escola_id: ctx.escolaId });
    if (error) return failure(error);
    const parsed = Preview.safeParse(data);
    if (!parsed.success ||
        parsed.data.documentos.some((doc) =>
          doc.conferidas > doc.linhas || doc.detalhes.length !== doc.linhas)) {
      return respond({ ok: false, error: "Não foi possível validar a lista de pautas." }, 503);
    }
    return respond(parsed.data);
  } catch {
    return respond({ ok: false, error: "Falha ao consultar as pautas escolares." }, 503);
  }
}

export async function POST(request: Request) {
  // JSON-only, same-origin, server-authorized mutations. No service-role key.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return respond({ ok: false, error: "Origem da operação inválida." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond({ ok: false, error: "Formato de pedido inválido." }, 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return respond({ ok: false, error: "Pedido demasiado grande." }, 413);
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return respond({ ok: false, error: "Pedido inválido." }, 400); }
  const parsed = Input.safeParse(body);
  if (!parsed.success) return respond({ ok: false, error: "Verifique os campos obrigatórios." }, 400);

  try {
    const ctx = await context(parsed.data.escola);
    if (ctx.response) return ctx.response;
    const client = ctx.db as unknown as DatabaseRPC;
    if (parsed.data.acao === "conferir_pauta") {
      const { data, error } = await client.rpc("curtume_2025_confirmar_pauta_documental", {
        p_escola_id: ctx.escolaId, p_documento: parsed.data.arquivo,
        p_snapshot: parsed.data.digest, p_referencia: parsed.data.referencia,
        p_motivo: parsed.data.motivo, p_confirmacao: parsed.data.confirmacao,
      });
      if (error) return failure(error);
      const result = z.object({
        ok: z.literal(true), linhas: z.number().int().min(1).max(200),
        novas_confirmacoes: z.number().int().min(0).max(200),
        ja_confirmadas: z.number().int().min(0).max(200),
      }).safeParse(data);
      if (!result.success) return respond({ ok: false, error: "A operação não foi confirmada. Recarregue o estado." }, 503);
      return respond(result.data);
    }
    // Reuse the existing, tenant-scoped HIST_FINAL mirror. Never create a second notes writer.
    const { data, error } = await client.rpc("curtume_2025_espelhar_notas_finais", {
      p_escola_id: ctx.escolaId, p_limite: parsed.data.limite,
    });
    if (error) return failure(error);
    const result = z.object({
      ok: z.literal(true), criadas: z.number().int().min(0).max(parsed.data.limite),
      restantes: z.number().int().min(0),
    }).safeParse(data);
    if (!result.success) return respond({ ok: false, error: "Não foi possível confirmar o lote. Reconsulte o estado." }, 503);
    return respond(result.data);
  } catch {
    return respond({ ok: false, error: "Operação não concluída. Atualize o estado antes de repetir." }, 503);
  }
}
