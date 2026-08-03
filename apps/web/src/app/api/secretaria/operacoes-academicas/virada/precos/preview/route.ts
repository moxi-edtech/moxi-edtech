import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildPricingProposal, PricingAdjustmentSchema } from "@/lib/virada/pricing-adjustment";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  ano_origem: z.number().int().min(2000).max(2200),
  ano_destino: z.number().int().min(2000).max(2200),
  ajuste: PricingAdjustmentSchema,
}).refine((body) => body.ano_destino > body.ano_origem, {
  message: "O ano de destino deve ser posterior ao ano de origem.",
  path: ["ano_destino"],
});

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financeiro_tabelas")
    .select("id, curso_id, classe_id, valor_matricula, valor_mensalidade, dia_vencimento, multa_atraso_percentual, multa_diaria")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", parsed.data.ano_origem)
    .order("classe_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const proposta = buildPricingProposal(data || [], parsed.data.ajuste);
  return NextResponse.json({
    ok: true,
    dry_run: true,
    ano_origem: parsed.data.ano_origem,
    ano_destino: parsed.data.ano_destino,
    summary: {
      tabelas: proposta.length,
      overrides: proposta.filter((row) => row.alterado_manualmente).length,
    },
    proposta,
  });
}
