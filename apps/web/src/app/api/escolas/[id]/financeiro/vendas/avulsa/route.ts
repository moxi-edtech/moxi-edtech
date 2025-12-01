import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const BodySchema = z.object({
  aluno_id: z.string().uuid("aluno_id inválido"),
  valor: z.number().positive(),
  descricao: z.string().trim().min(1),
  metodo: z.string().trim().min(1).optional(),
  pago_imediato: z.boolean().default(false),
  matricula_id: z.string().uuid().optional(),
  comprovativo_url: z.string().url().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const json = await req.json().catch(() => null);
    const parse = BodySchema.safeParse(json);
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const body = parse.data;

    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: vinc } = await s
      .from("escola_usuarios")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .limit(1);
    const papel = (vinc?.[0] as any)?.papel as any;
    if (!hasPermission(papel, "registrar_pagamento")) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil não vinculado à escola" }, { status: 403 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração do Supabase ausente" }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any;

    const lancRes = await admin
      .from("financeiro_lancamentos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        matricula_id: body.matricula_id ?? null,
        tipo: "debito",
        origem: "venda_avulsa",
        descricao: body.descricao,
        valor_original: body.valor as any,
        status: body.pago_imediato ? "pago" : "pendente",
        data_pagamento: body.pago_imediato ? new Date().toISOString() : null,
        metodo_pagamento: body.pago_imediato ? (body.metodo as any) : null,
        comprovativo_url: body.comprovativo_url ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (lancRes.error || !lancRes.data) {
      return NextResponse.json(
        { ok: false, error: lancRes.error?.message || "Falha ao registrar venda" },
        { status: 400 }
      );
    }

    const pagamentoRes = await admin
      .from("pagamentos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        valor: body.valor as any,
        status: body.pago_imediato ? "pago" : "pendente",
        metodo: body.metodo ?? null,
        referencia: `venda_avulsa:${(lancRes.data as any).id}`,
        descricao: body.descricao,
        comprovante_url: body.comprovativo_url ?? null,
      })
      .select("id")
      .single();

    if (pagamentoRes.error || !pagamentoRes.data) {
      await admin
        .from("financeiro_lancamentos")
        .delete()
        .eq("id", (lancRes.data as any).id)
        .eq("escola_id", escolaId);
      return NextResponse.json(
        { ok: false, error: pagamentoRes.error?.message || "Falha ao registrar pagamento" },
        { status: 400 }
      );
    }

    await admin.rpc("refresh_all_materialized_views").catch(() => null);

    return NextResponse.json({
      ok: true,
      lancamento_id: (lancRes.data as any).id,
      pagamento_id: (pagamentoRes.data as any).id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
