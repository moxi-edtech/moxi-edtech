import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";

// --- HELPERS PARA GERAR CÓDIGO (Consistência com outras rotas) ---
const normalizeNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const makeCursoCodigo = (nome: string, escolaId: string): string => {
  const prefix = escolaId.replace(/-/g, "").slice(0, 8);
  return `${prefix}_${normalizeNome(nome)}`;
};

// GET /api/escolas/[id]/cursos
// Lista cursos da escola (usa service role com autorização)
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

    // Buscar cursos com colunas opcionais em fallback
    let rows: any[] = [];
    {
      let query = (admin as any)
        .from('cursos')
        .select('id, nome, nivel, descricao, codigo, course_code, curriculum_key, tipo')
        .eq('escola_id', escolaId)
        .order('nome', { ascending: true });
      query = applyKf2ListInvariants(query, { defaultLimit: 500 });

      const { data, error } = await query;
      if (!error) rows = data || [];
      else {
        // Retry com menos colunas se falhar
        let retryQuery = (admin as any)
          .from('cursos')
          .select('id, nome, codigo')
          .eq('escola_id', escolaId)
          .order('nome', { ascending: true });
        retryQuery = applyKf2ListInvariants(retryQuery, { defaultLimit: 500 });

        const retry = await retryQuery;
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }

    // Mapear para o tipo Course esperado pelo front
    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo ?? "geral",
      periodo_id: undefined,
      semestre_id: undefined,
      professor_id: undefined,
      nivel: r.nivel ?? undefined,
      descricao: r.descricao ?? undefined,
      codigo: r.course_code || r.codigo || undefined,
      curriculum_key: r.curriculum_key ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/cursos
// Cria um novo curso (usa service role com autorização)
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
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      nome: z.string().trim().min(1),
      nivel: z.string().trim().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      codigo: z.string().trim().nullable().optional(),
      course_code: z.string().trim().nullable().optional(),
      curriculum_key: z.string().trim().nullable().optional(),
      tipo: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // Se o código não veio, gera automaticamente
    const codigoFinal = parsed.data.codigo || makeCursoCodigo(parsed.data.nome, escolaId);

    const courseCodeFinal =
      parsed.data.course_code || parsed.data.curriculum_key || null;

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      codigo: codigoFinal, // Garante que sempre tenha código
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;
    if (parsed.data.tipo !== undefined) payload.tipo = parsed.data.tipo;
    if (parsed.data.curriculum_key !== undefined) payload.curriculum_key = parsed.data.curriculum_key;
    if (courseCodeFinal !== null) payload.course_code = courseCodeFinal;

    const { data: ins, error } = await (admin as any)
      .from('cursos')
      .insert(payload)
      .select('id, nome, nivel, descricao, codigo, course_code, curriculum_key, tipo')
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de erro de duplicidade
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `O curso "${parsed.data.nome}" já existe nesta escola.` },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    try {
      await (admin as any).from("notifications").insert({
        escola_id: escolaId,
        target_role: "financeiro",
        tipo: "curso_precos_pendentes",
        titulo: `Novo curso criado: ${ins?.nome || parsed.data.nome}`,
        mensagem: "Configure a tabela de preços para liberar matrículas e propinas.",
        link_acao: "/financeiro/configuracoes/precos",
      });
    } catch (notifyError) {
      console.warn("Falha ao notificar financeiro:", notifyError);
    }

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
