import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { idiomaSchema } from "@/lib/academico/lingua-estrangeira";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function handle(req: Request, ctx: Ctx, write: boolean) {
  try {
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply({ ok: false, error: "Não autenticado" }, 401);
    const { id } = await ctx.params;
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, id);
    if (!escolaId) return reply({ ok: false, error: "Sem permissão" }, 403);
    const body = write ? idiomaSchema.safeParse(await req.json().catch(() => null)) : null;
    if (body && !body.success) return reply({ ok: false, error: "Seleccione um idioma válido." }, 400);

    // The RPC independently validates the current tenant and a fresh authorized membership.
    const { data, error } = await (supabase as any).rpc("klasse_lingua_estrangeira_config_v1", {
      p_escola_id: escolaId,
      p_write: write,
      p_idioma: body?.success ? body.data.idioma : null,
      p_outro: body?.success ? body.data.outro ?? null : null,
    });
    if (error) {
      if (error.code === "42501") return reply({ ok: false, error: "Sem permissão" }, 403);
      if (error.code === "22023") return reply({ ok: false, error: "Idioma inválido." }, 400);
      if (error.code === "PGRST202" || error.code === "42883")
        return reply({ ok: false, error: "Configuração de idioma ainda indisponível." }, 503);
      console.error("[lingua-estrangeira]", error.code);
      return reply({ ok: false, error: "Não foi possível carregar ou guardar a configuração." }, 500);
    }
    return reply({ ok: true, data });
  } catch {
    return reply({ ok: false, error: "Não foi possível carregar ou guardar a configuração." }, 500);
  }
}

export const GET = (req: Request, ctx: Ctx) => handle(req, ctx, false);
export const PUT = (req: Request, ctx: Ctx) => handle(req, ctx, true);
