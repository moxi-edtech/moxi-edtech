import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../permissions";

// GET /api/escolas/[id]/disciplinas
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const rows = await (async () => {
      const { data, error } = await (admin as any)
        .from("disciplinas")
        .select("id, nome, tipo, curso_escola_id, classe_nome, classe_id, nivel_ensino, carga_horaria, sigla")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });

      if (!error) return data || [];

      // Retry with minimal shape if schema differs
      const fallback = await (admin as any)
        .from("disciplinas")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });
      if (fallback.error) throw fallback.error;
      return fallback.data || [];
    })();

    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo ?? "core",
      curso_id: r.curso_escola_id ?? r.curso_id ?? undefined,
      classe_id: r.classe_id ?? undefined,
      classe_nome: r.classe_nome ?? undefined,
      nivel_ensino: r.nivel_ensino ?? undefined,
      carga_horaria: r.carga_horaria ?? undefined,
      sigla: r.sigla ?? undefined,
    }));

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/disciplinas
// Cria uma disciplina (opcionalmente vinculada a curso e/ou classe)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      nome: z.string().trim().min(1),
      tipo: z.enum(["core", "eletivo"]).optional().default("core"),
      curso_id: z.string().uuid(),
      classe_nome: z.string().trim(),
      classe_id: z.string().uuid().nullable().optional(),
      nivel_ensino: z.string().trim().nullable().optional(),
      carga_horaria: z.number().int().nullable().optional(),
      sigla: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      tipo: parsed.data.tipo,
      curso_escola_id: parsed.data.curso_id,
      classe_nome: parsed.data.classe_nome,
    };
    if (parsed.data.classe_id !== undefined) payload.classe_id = parsed.data.classe_id;
    if (parsed.data.nivel_ensino !== undefined) payload.nivel_ensino = parsed.data.nivel_ensino;
    if (parsed.data.carga_horaria !== undefined) payload.carga_horaria = parsed.data.carga_horaria;
    if (parsed.data.sigla !== undefined) payload.sigla = parsed.data.sigla;

    const { data: ins, error } = await (admin as any)
      .from("disciplinas")
      .insert(payload)
      .select("id, nome, tipo, curso_escola_id, classe_nome, classe_id, nivel_ensino, carga_horaria, sigla")
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de duplicidade
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `A disciplina "${parsed.data.nome}" já existe.` },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
