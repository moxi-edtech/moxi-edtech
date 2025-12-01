import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

function parseAnoLetivo(value: unknown) {
  const n = typeof value === "string" ? Number(value) : Number(value ?? "");
  if (!Number.isFinite(n)) return null;
  const year = Math.trunc(n);
  if (year < 1900 || year > 3000) return null;
  return year;
}

async function usuarioTemAcessoEscola(client: any, userId: string, escolaId: string) {
  if (!escolaId) return false;
  try {
    const { data: prof } = await client
      .from("profiles")
      .select("current_escola_id, escola_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const perfil = prof?.[0] as any;
    const role = perfil?.role as string | undefined;
    if (role === "super_admin") return true;
    if (perfil?.current_escola_id === escolaId || perfil?.escola_id === escolaId) return true;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_usuarios")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .maybeSingle();
    if ((vinc as any)?.papel) return true;
  } catch {}

  try {
    const { data: adminLink } = await client
      .from("escola_administradores")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1);
    if (adminLink && (adminLink as any[]).length > 0) return true;
  } catch {}

  return false;
}

async function resolverEscola(client: any, userId: string, provided?: string | null) {
  if (provided) return provided;

  try {
    const { data: prof } = await client
      .from("profiles" as any)
      .select("current_escola_id, escola_id")
      .eq("user_id", userId)
      .limit(1);
    const perfil = prof?.[0] as any;
    if (perfil?.current_escola_id) return perfil.current_escola_id as string;
    if (perfil?.escola_id) return perfil.escola_id as string;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_usuarios")
      .select("escola_id")
      .eq("user_id", userId)
      .limit(1);
    const vinculo = vinc?.[0] as any;
    if (vinculo?.escola_id) return vinculo.escola_id as string;
  } catch {}

  return null;
}

function dinheiroValido(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function clampDiaVencimento(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(31, Math.trunc(n)));
}

export async function GET(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const escolaParam = url.searchParams.get("escola_id");
    const anoParam = url.searchParams.get("ano_letivo") || url.searchParams.get("ano");
    const cursoId = url.searchParams.get("curso_id");
    const classeId = url.searchParams.get("classe_id");

    const anoLetivo = parseAnoLetivo(anoParam ?? new Date().getFullYear());
    if (!anoLetivo) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });
    }

    const escolaId = await resolverEscola(s as any, user.id, escolaParam);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const autorizado = await usuarioTemAcessoEscola(s as any, user.id, escolaId);
    if (!autorizado) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const { data, error } = await s
      .from("financeiro_tabelas")
      .select(
        "id, escola_id, ano_letivo, curso_id, classe_id, valor_matricula, valor_mensalidade, dia_vencimento, multa_atraso_percentual, created_at, updated_at"
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let resolved: any = null;
    try {
      resolved = await resolveTabelaPreco(s as any, {
        escolaId,
        anoLetivo,
        cursoId: cursoId || undefined,
        classeId: classeId || undefined,
      });
    } catch {}

    return NextResponse.json({ ok: true, items: data || [], resolved });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      escola_id,
      ano_letivo,
      curso_id,
      classe_id,
      valor_matricula,
      valor_mensalidade,
      dia_vencimento,
      multa_atraso_percentual,
    } = body || {};

    const escolaId = await resolverEscola(s as any, user.id, escola_id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
    const autorizado = await usuarioTemAcessoEscola(s as any, user.id, escolaId);
    if (!autorizado) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const anoLetivo = parseAnoLetivo(ano_letivo ?? new Date().getFullYear());
    if (!anoLetivo) return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });

    const valorMatriculaNum = dinheiroValido(valor_matricula);
    const valorMensalidadeNum = dinheiroValido(valor_mensalidade);
    if (valorMatriculaNum === null && valorMensalidadeNum === null) {
      return NextResponse.json({ ok: false, error: "Informe matrícula ou mensalidade" }, { status: 400 });
    }

    const payload: any = {
      escola_id: escolaId,
      ano_letivo: anoLetivo,
      curso_id: curso_id || null,
      classe_id: classe_id || null,
      valor_matricula: valorMatriculaNum ?? 0,
      valor_mensalidade: valorMensalidadeNum ?? 0,
      dia_vencimento: clampDiaVencimento(dia_vencimento),
      updated_at: new Date().toISOString(),
    };
    if (multa_atraso_percentual !== undefined) {
      const multa = dinheiroValido(multa_atraso_percentual);
      if (multa !== null) payload.multa_atraso_percentual = multa;
    }

    const { data, error } = await s
      .from("financeiro_tabelas")
      .upsert(payload, { onConflict: "escola_id, ano_letivo, curso_id, classe_id" })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id, ano_letivo, valor_matricula, valor_mensalidade, dia_vencimento, multa_atraso_percentual } = body || {};
    if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

    const { data: existente, error: findErr } = await s
      .from("financeiro_tabelas")
      .select("id, escola_id")
      .eq("id", id)
      .maybeSingle();
    if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 400 });
    if (!existente) return NextResponse.json({ ok: false, error: "Registro não encontrado" }, { status: 404 });

    const autorizado = await usuarioTemAcessoEscola(s as any, user.id, (existente as any).escola_id as string);
    if (!autorizado) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const updates: any = { updated_at: new Date().toISOString() };
    if (ano_letivo !== undefined) {
      const parsedAno = parseAnoLetivo(ano_letivo);
      if (!parsedAno) return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });
      updates.ano_letivo = parsedAno;
    }
    if (valor_matricula !== undefined) {
      const v = dinheiroValido(valor_matricula);
      if (v === null) return NextResponse.json({ ok: false, error: "Valor de matrícula inválido" }, { status: 400 });
      updates.valor_matricula = v;
    }
    if (valor_mensalidade !== undefined) {
      const v = dinheiroValido(valor_mensalidade);
      if (v === null) return NextResponse.json({ ok: false, error: "Valor de mensalidade inválido" }, { status: 400 });
      updates.valor_mensalidade = v;
    }
    if (dia_vencimento !== undefined) {
      const v = clampDiaVencimento(dia_vencimento);
      if (v === null) updates.dia_vencimento = null;
      else updates.dia_vencimento = v;
    }
    if (multa_atraso_percentual !== undefined) {
      const multa = dinheiroValido(multa_atraso_percentual);
      if (multa !== null) updates.multa_atraso_percentual = multa;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ ok: false, error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const { data, error } = await s
      .from("financeiro_tabelas")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
