import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const StatusSchema = z.object({ status: z.enum(["rascunho", "publicado", "arquivado"]) });

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = StatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Estado inválido" }, { status: 400 });

  const { data: item, error } = await supabase
    .from("materiais_pedagogicos")
    .update({
      status: parsed.data.status,
      published_at: parsed.data.status === "publicado" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .select("id, titulo, status, published_at, updated_at")
    .maybeSingle();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  if (!item) return noStore({ ok: false, error: "Material não encontrado", next_action: { type: "return_to_materials", label: "Voltar aos materiais", href: "/professor/materiais" } }, { status: 404 });
  return noStore({ ok: true, item });
}
