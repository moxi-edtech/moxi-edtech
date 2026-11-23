import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const roles = [
  "admin", "admin_escola", "admin_financeiro", "admin_secretaria",
  "admin_secretario", "secretaria", "financeiro", "diretor", "staff_admin",
] as const;

const updateSchema = z.object({
  matricula_id: z.string().uuid(),
  bolseiro: z.boolean(),
  motivo: z.string().trim().max(160).nullable().optional(),
  vigencia_inicio: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-01$/).nullable().optional(),
});

async function contexto(req: Request, id: string) {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: NextResponse.json({ ok: false, error: "Aluno inválido" }, { status: 400 }) };
  }
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };

  const requestedEscola = new URL(req.url).searchParams.get("escola_id");
  if (requestedEscola && !z.string().uuid().safeParse(requestedEscola).success) {
    return { error: NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 400 }) };
  }
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscola);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não autorizada" }, { status: 403 }) };

  const authz = await requireRoleInSchool({
    supabase, escolaId, roles: [...roles], productContext: "k12",
  });
  if (authz.error) return { error: authz.error };

  const { data: aluno, error: alunoError } = await supabase
    .from("alunos").select("id").eq("id", id).eq("escola_id", escolaId).maybeSingle();
  if (alunoError) return { error: NextResponse.json({ ok: false, error: "Erro a consultar aluno" }, { status: 500 }) };
  if (!aluno) return { error: NextResponse.json({ ok: false, error: "Aluno não encontrado nesta escola" }, { status: 404 }) };
  return { supabase, escolaId };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(req, id);
  if (ctx.error) return ctx.error;

  const year = new URL(req.url).searchParams.get("ano_letivo");
  if (year && !/^20[2-9][0-9]$/.test(year)) {
    return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });
  }

  let query = ctx.supabase!
    .from("matriculas")
    .select("id, ano_letivo, status, bolsa_integral, bolsa_integral_motivo, bolsa_integral_inicio, percentagem_desconto, motivo_desconto")
    .eq("escola_id", ctx.escolaId)
    .eq("aluno_id", id)
    .order("ano_letivo", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (year) query = query.eq("ano_letivo", Number(year));
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível consultar a matrícula" }, { status: 500 });

  const matriculas = data ?? [];
  const atual = matriculas.find((m: any) => ["ativo", "ativa", "matriculado", "active"].includes(m.status))
    ?? matriculas[0] ?? null;
  if (!atual) return NextResponse.json({ ok: true, matricula: null }, { headers: { "Cache-Control": "no-store" } });

  // Renovação anual exige nova decisão: benefício anterior é apenas contexto.
  const { data: anteriores, error: anterioresError } = await ctx.supabase!
    .from("matriculas")
    .select("ano_letivo,bolsa_integral,percentagem_desconto,motivo_desconto")
    .eq("escola_id",ctx.escolaId).eq("aluno_id",id)
    .lt("ano_letivo",atual.ano_letivo)
    .order("ano_letivo",{ascending:false}).limit(20);
  if (anterioresError) return NextResponse.json({ok:false,error:"Falha a consultar histórico da bolsa"},{status:500});
  const bolsaAnterior = (anteriores ?? []).find((m: any) => Boolean(m.bolsa_integral ||
    (Number(m.percentagem_desconto ?? 0) === 100 && /bolsa/i.test(m.motivo_desconto ?? ""))));

  return NextResponse.json({
    ok: true,
    matricula: {
      id: atual.id,
      ano_letivo: atual.ano_letivo,
      status: atual.status,
      bolseiro: Boolean(atual.bolsa_integral ||
        (Number(atual.percentagem_desconto ?? 0) >= 100 &&
         /bolsa/i.test(atual.motivo_desconto ?? ""))),
      bolsa_integral: Boolean(atual.bolsa_integral),
      isencao_outra_politica: Boolean(!atual.bolsa_integral &&
        Number(atual.percentagem_desconto ?? 0) >= 100 &&
        !/bolsa/i.test(atual.motivo_desconto ?? "")),
      motivo: atual.bolsa_integral_motivo ?? atual.motivo_desconto ?? null,
      vigencia_inicio: atual.bolsa_integral_inicio ?? null,
      bolsa_ano_anterior: bolsaAnterior ? Number(bolsaAnterior.ano_letivo) : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(req, id);
  if (ctx.error) return ctx.error;
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados da bolsa inválidos" }, { status: 400 });

  const { data, error } = await ctx.supabase!.rpc("klasse_definir_bolsa_integral", {
    p_escola_id: ctx.escolaId,
    p_aluno_id: id,
    p_matricula_id: parsed.data.matricula_id,
    p_bolseiro: parsed.data.bolseiro,
    p_motivo: parsed.data.motivo ?? null,
    p_vigencia_inicio: parsed.data.vigencia_inicio ?? null,
  });
  if (error || !data?.ok) {
    const code = error?.code;
    return NextResponse.json(
      { ok: false, error: code === "42501" ? "Sem permissão para gerir bolsas" : code === "P0002" ? "Matrícula não encontrada" : code === "23514" ? "Vigência inválida ou benefício incompatível com a matrícula" : "Não foi possível atualizar a bolsa" },
      { status: code === "42501" ? 403 : code === "P0002" ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, bolsa: data }, { headers: { "Cache-Control": "no-store" } });
}
