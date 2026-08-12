import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MaterialSchema = z.object({
  titulo: z.string().trim().min(2).max(180),
  descricao: z.string().trim().max(2000).nullable().optional(),
  conteudo: z.string().trim().max(100_000).nullable().optional(),
  arquivo_url: z.string().url().max(2000).nullable().optional(),
  turma_id: z.string().uuid().nullable().optional(),
  disciplina_id: z.string().uuid().nullable().optional(),
});

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

async function context() {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, escolaId: null };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  return { supabase, user, escolaId };
}

export async function GET() {
  const { supabase, user, escolaId } = await context();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });

  const { data, error } = await supabase
    .from("materiais_pedagogicos")
    .select("id, titulo, descricao, conteudo, arquivo_url, turma_id, disciplina_id, status, published_at, created_at, updated_at")
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });
  return noStore({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, escolaId } = await context();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });

  const parsed = MaterialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Dados do material inválidos" }, { status: 400 });
  if (!parsed.data.conteudo && !parsed.data.arquivo_url) {
    return noStore({ ok: false, error: "Informe conteúdo ou um arquivo" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("materiais_pedagogicos")
    .insert({ escola_id: escolaId, created_by: user.id, ...parsed.data, status: "rascunho" })
    .select("id, titulo, descricao, conteudo, arquivo_url, turma_id, disciplina_id, status, published_at, created_at")
    .single();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  return noStore({ ok: true, item: data }, { status: 201 });
}
