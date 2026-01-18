import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";

const CobrancaItemSchema = z.object({
  aluno_id: z.string().uuid(),
  mensalidade_id: z.string().uuid().nullable().optional(),
  canal: z.enum(["whatsapp", "sms", "email", "manual"]),
  status: z.enum(["enviada", "entregue", "respondida", "paga", "falha"]).optional(),
  mensagem: z.string().optional(),
  resposta: z.string().optional(),
  enviado_em: z.string().datetime().optional(),
});

const CobrancaPayloadSchema = z.object({
  items: z.array(CobrancaItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    let query = supabase
      .from("financeiro_cobrancas")
      .select(
        `
        id,
        canal,
        status,
        mensagem,
        resposta,
        enviado_em,
        created_at,
        alunos (
          id,
          nome,
          responsavel,
          telefone_responsavel
        ),
        mensalidades (
          id,
          valor_previsto,
          data_vencimento,
          status
        )
      `
      );

    query = applyKf2ListInvariants(query);
    
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    let items = (data ?? []) as any[];
    if (q) {
      items = items.filter((row) => {
        const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        const nome = String(aluno?.nome ?? "").toLowerCase();
        const responsavel = String(aluno?.responsavel ?? "").toLowerCase();
        return nome.includes(q) || responsavel.includes(q);
      });
    }

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CobrancaPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { data: escolaId, error: escolaError } = await supabase.rpc("current_tenant_escola_id");
    if (escolaError || !escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const rows = parsed.data.items.map((item) => ({
      escola_id: escolaId,
      aluno_id: item.aluno_id,
      mensalidade_id: item.mensalidade_id ?? null,
      canal: item.canal,
      status: item.status ?? "enviada",
      mensagem: item.mensagem ?? null,
      resposta: item.resposta ?? null,
      enviado_em: item.enviado_em ?? new Date().toISOString(),
      created_by: user.id,
    }));

    const { data, error } = await supabase.from("financeiro_cobrancas").insert(rows).select("id");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, created: data?.length ?? 0 }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
