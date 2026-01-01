import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeAnoLetivo, resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import { createClient as createAdminClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

function isUUID(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

async function resolverEscolaId(client: SupabaseClient, user: User, provided?: string | null) {
  if (provided && isUUID(provided)) return provided;

  try {
    const { data } = await client.rpc("current_tenant_escola_id");
    if (data && isUUID(data as string)) return data as string;
  } catch {}

  const claimEscola = (user?.app_metadata?.escola_id || user?.user_metadata?.escola_id) as
    | string
    | undefined;
  if (claimEscola && isUUID(claimEscola)) return claimEscola;

  try {
    const { data: prof } = await client
      .from("profiles")
      .select("current_escola_id, escola_id")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const perfil = prof?.[0] as { current_escola_id?: string | null; escola_id?: string | null } | undefined;
    if (perfil?.current_escola_id) return perfil.current_escola_id as string;
    if (perfil?.escola_id) return perfil.escola_id as string;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_users")
      .select("escola_id")
      .eq("user_id", user?.id)
      .limit(1);
    const escola = (vinc?.[0] as { escola_id?: string | null })?.escola_id as string | undefined;
    if (escola) return escola;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_users")
      .select("escola_id")
      .eq("user_id", user?.id)
      .limit(1);
    const escola = (vinc?.[0] as { escola_id?: string | null })?.escola_id as string | undefined;
    if (escola) return escola;
  } catch {}

  return null;
}

async function usuarioTemAcessoEscola(client: SupabaseClient, userId: string, escolaId: string) {
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
      .from("escola_users")
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

function getPrivilegedClient(fallback: SupabaseClient) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRole) {
    return createAdminClient<Database>(url, serviceRole);
  }

  return fallback;
}

function parseAnoLetivoStrict(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    if (year >= 1900 && year <= 3000) return year;
  }

  const texto = String(value).trim();
  const match = texto.match(/(19|20)\d{2}/);
  if (match && match[0]) {
    const year = Number(match[0]);
    if (year >= 1900 && year <= 3000) return year;
  }

  const digits = texto.replace(/\D+/g, "");
  const numeric = Number(digits);
  if (Number.isFinite(numeric)) {
    const year = Math.trunc(numeric);
    if (year >= 1900 && year <= 3000) return year;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id"); // compat: agora mapeado para anos_letivos.id
  const cursoId = (searchParams.get("curso_id") || "").trim() || undefined;
  const classeId = (searchParams.get("classe_id") || "").trim() || undefined;
  // O ano letivo idealmente vem da sessão ativa, mas aceitamos parâmetro manual
  const anoParam = parseAnoLetivoStrict(searchParams.get("ano"));

  try {
    const supabase = await supabaseServer();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    let session: any = null;
    if (sessionId && isUUID(sessionId)) {
      try {
        const { data } = await supabase
          .from("anos_letivos")
          .select("id, escola_id, ano, data_inicio, data_fim, ativo")
          .eq("id", sessionId)
          .maybeSingle();
        session = data || null;
      } catch {}
    }

    const escolaId =
      (session?.escola_id && isUUID(session.escola_id) ? session.escola_id : null) ||
      (await resolverEscolaId(supabase, user, searchParams.get("escola_id")));

    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const autorizado = await usuarioTemAcessoEscola(supabase as any, user.id, escolaId);
    if (!autorizado) {
      return NextResponse.json({ ok: false, error: "Sem permissão para consultar preços" }, { status: 403 });
    }

    // Prioriza ano fornecido explicitamente; se não houver, tenta derivar da sessão
    const anoDerivadoDaSessao =
      parseAnoLetivoStrict(session?.ano) ||
      (session?.data_inicio ? new Date(session.data_inicio).getFullYear() : null) ||
      (session?.data_fim ? new Date(session.data_fim).getFullYear() : null);

    let anoLetivo = anoParam || anoDerivadoDaSessao || null;

    if (!anoLetivo && escolaId) {
      try {
        const { data: ativo } = await supabase
          .from('anos_letivos')
          .select('ano')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .order('ano', { ascending: false })
          .maybeSingle();
        if (ativo?.ano) anoLetivo = Number(ativo.ano);
      } catch {}
    }

    anoLetivo = anoLetivo || normalizeAnoLetivo(null);

    const pricingParams = {
      escolaId,
      anoLetivo,
      cursoId,
      classeId,
      allowMensalidadeFallback: true, // permite usar regras legadas de mensalidade se não houver tabela específica
    } as const;

    let { tabela, origem } = await resolveTabelaPreco(supabase as any, pricingParams);

    if (!tabela) {
      const privileged = getPrivilegedClient(supabase as any);
      if (privileged !== supabase) {
        const fallback = await resolveTabelaPreco(privileged as any, pricingParams);
        tabela = fallback.tabela;
        origem = fallback.origem;
      }
    }

    if (!tabela) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nenhuma tabela de preços encontrada para este cenário.",
          code: "NO_PRICE_TABLE",
        },
        { status: 404 },
      );
    }

    // Sucesso
    return NextResponse.json({
      ok: true,
      data: {
        valor_matricula: tabela.valor_matricula,
        valor_mensalidade: tabela.valor_mensalidade,
        dia_vencimento: tabela.dia_vencimento,
        multa: tabela.multa_atraso_percentual,
        origem_regra: origem,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
