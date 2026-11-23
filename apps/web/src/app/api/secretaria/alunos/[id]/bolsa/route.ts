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
  regularizacao_retroativa: z.boolean().optional(),
  justificativa: z.string().trim().max(500).nullable().optional(),
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
    .select("id, turma_id, ano_letivo, status, bolsa_integral, bolsa_integral_motivo, bolsa_integral_inicio, percentagem_desconto, motivo_desconto")
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

  const { data: ano, error: anoError } = await ctx.supabase!
    .from("anos_letivos").select("data_inicio,data_fim")
    .eq("escola_id",ctx.escolaId).eq("ano",atual.ano_letivo)
    .order("ativo",{ascending:false}).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (anoError) return NextResponse.json({ok:false,error:"Não foi possível consultar o ano letivo"},{status:500});
  const { data: cobrancas, error: cobrancasError } = await ctx.supabase!
    .from("mensalidades")
    .select("id,matricula_id,turma_id,ano_referencia,mes_referencia,valor_pago_total,valor_previsto,valor,valor_original,status,bolsa_isencao_integral,fiscal_documento_id,status_fiscal")
    .eq("escola_id",ctx.escolaId).eq("aluno_id",id)
    .eq("ano_letivo",String(atual.ano_letivo)).limit(300);
  if (cobrancasError) return NextResponse.json({ok:false,error:"Não foi possível consultar propinas"},{status:500});
  const ids = (cobrancas ?? [])
    .filter((me: any) => me.matricula_id === atual.id ||
      (!me.matricula_id && me.turma_id === atual.turma_id))
    .map((me: any) => me.id as string);
  // Fail-closed: sem consultar pagamentos/documentos não se pode prometer isenção.
  const [pagamentosResult, documentosResult, historicoResult] = await Promise.all([
    ids.length
      ? ctx.supabase!.from("pagamentos").select("mensalidade_id,status,valor_pago,status_fiscal,fiscal_documento_id").eq("escola_id", ctx.escolaId).in("mensalidade_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? ctx.supabase!.from("documentos_emitidos").select("mensalidade_id").eq("escola_id", ctx.escolaId).in("mensalidade_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ctx.supabase!.from("audit_logs")
      .select("created_at,action,details")
      .eq("escola_id", ctx.escolaId)
      .eq("entity", "matriculas")
      .eq("entity_id", atual.id)
      .in("action", ["BOLSA_INTEGRAL_ATUALIZADA", "BOLSA_INTEGRAL_NA_MATRICULA"])
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (pagamentosResult.error || documentosResult.error) {
    return NextResponse.json({ ok: false, error: "Não foi possível validar pagamentos e documentos das propinas" }, { status: 500 });
  }
  const pagamentosPorMensalidade = new Map<string, Array<{
    status: string; valor_pago: number; status_fiscal: string | null; fiscal_documento_id: string | null;
  }>>();
  for (const pagamento of (pagamentosResult.data ?? [])) {
    const key = String(pagamento.mensalidade_id);
    pagamentosPorMensalidade.set(key, [...(pagamentosPorMensalidade.get(key) ?? []), pagamento]);
  }
  const comDocumento = new Set((documentosResult.data ?? []).map((row: any) => row.mensalidade_id));
  const cobrancasDaMatricula = (cobrancas ?? [])
    .filter((me: any) => me.matricula_id === atual.id || (!me.matricula_id && me.turma_id === atual.turma_id));
  const previsao = cobrancasDaMatricula
    .filter((me: any) => Number.isInteger(me.ano_referencia) && me.mes_referencia >= 1 && me.mes_referencia <= 12)
    .map((me: any) => {
      const pagamentos = pagamentosPorMensalidade.get(me.id) ?? [];
      const temPagamento = pagamentos.length > 0 || Number(me.valor_pago_total ?? 0) > 0;
      const liquidado = pagamentos.filter(pg => ["settled", "concluido", "pago"].includes(pg.status))
        .reduce((total, pg) => total + Number(pg.valor_pago ?? 0), 0);
      const parcialConsistente = me.status === "pago_parcial"
        && Number(me.valor_pago_total ?? 0) > 0
        && Number(me.valor_pago_total ?? 0) === liquidado
        && Number(me.valor_pago_total ?? 0) < Number(me.valor_previsto ?? me.valor ?? 0);
      const temFiscal = Boolean(me.fiscal_documento_id || comDocumento.has(me.id) ||
        (me.status_fiscal && me.status_fiscal !== "pending") ||
        pagamentos.some(pg => pg.fiscal_documento_id ||
          (pg.status_fiscal && pg.status_fiscal !== "pending")));
      return {
        competencia: `${me.ano_referencia}-${String(me.mes_referencia).padStart(2, "0")}`,
        valor_aberto: Math.max(0, Number(me.valor_previsto ?? me.valor ?? 0) - Number(me.valor_pago_total ?? 0)),
        valor_original: Math.max(0, Number(me.valor_original ?? me.valor_previsto ?? me.valor ?? 0)),
        status: String(me.status),
        bolsa_isencao_integral: Boolean(me.bolsa_isencao_integral),
        elegivel: me.status === "pendente" && !temPagamento && !temFiscal,
        parcial_possivel: parcialConsistente && !temFiscal,
        requer_revisao: !["pago", "cancelado", "isento"].includes(me.status) &&
          (temFiscal || (temPagamento && !parcialConsistente)),
        motivo_revisao: temFiscal ? "Documento emitido" :
          temPagamento && !parcialConsistente ? "Pagamentos por conciliar" : null,
      };
    })
    .sort((a: any, b: any) => a.competencia.localeCompare(b.competencia));
  const mesAtual = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Luanda", year: "numeric", month: "2-digit",
  }).format(new Date());
  const mensalidadesPendentes = [...new Set(previsao
    .filter(item => item.elegivel && item.competencia < mesAtual)
    .map(item => item.competencia))].sort();

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
      ano_inicio: ano?.data_inicio ?? null,
      ano_fim: ano?.data_fim ?? null,
      propinas_antigas_potenciais: mensalidadesPendentes,
      previsao,
      previsao_incompleta: (cobrancas ?? []).length >= 300,
      historico: historicoResult.error ? null : (historicoResult.data ?? []).map((evento: any) => ({
        em: evento.created_at,
        acao: evento.action,
        inicio: evento.details?.vigencia_inicio ?? null,
        motivo: evento.details?.motivo ?? null,
        justificativa: evento.details?.justificativa_retroativa ?? null,
        isentas: Number(evento.details?.isentas ?? 0),
        revisoes: Number(evento.details?.pendentes_revisao_fiscal ?? 0)
          + Number(evento.details?.pendentes_revisao_pagamento ?? 0),
        atribuiu: Boolean(evento.details?.atual ?? true),
      })),
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
    p_regularizacao_retroativa: parsed.data.regularizacao_retroativa ?? false,
    p_justificativa: parsed.data.justificativa ?? null,
  });
  if (error || !data?.ok) {
    const code = error?.code;
    return NextResponse.json(
      { ok: false, error: code === "42501" ? "Sem permissão para gerir bolsas" : code === "P0002" ? "Matrícula não encontrada" : code === "23514" ? "Vigência ou justificação inválida. Confirme o início da bolsa e a regularização." : "Não foi possível atualizar a bolsa" },
      { status: code === "42501" ? 403 : code === "P0002" ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, bolsa: data }, { headers: { "Cache-Control": "no-store" } });
}
