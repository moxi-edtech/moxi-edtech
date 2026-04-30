import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"];

type FaqItem = {
  pergunta: string;
  resposta: string;
};

type LandingConfig = {
  badge: string;
  headline: string;
  descricao: string;
  banner_url: string;
  instrucoes: string;
  contactos: {
    whatsapp: string;
    telefone: string;
    email: string;
    endereco: string;
  };
  redes_sociais: {
    instagram: string;
    facebook: string;
    linkedin: string;
    website: string;
  };
  faq: FaqItem[];
};

const emptyConfig: LandingConfig = {
  badge: "",
  headline: "",
  descricao: "",
  banner_url: "",
  instrucoes: "",
  contactos: {
    whatsapp: "",
    telefone: "",
    email: "",
    endereco: "",
  },
  redes_sociais: {
    instagram: "",
    facebook: "",
    linkedin: "",
    website: "",
  },
  faq: [],
};

function cleanText(value: unknown, maxLength = 600) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeFaq(input: unknown): FaqItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      return {
        pergunta: cleanText(raw.pergunta, 180),
        resposta: cleanText(raw.resposta, 900),
      };
    })
    .filter((item) => item.pergunta && item.resposta)
    .slice(0, 8);
}

function normalizeConfig(input: unknown, defaults?: Partial<LandingConfig>): LandingConfig {
  const raw = (input ?? {}) as Record<string, unknown>;
  const contactos = ((raw.contactos ?? {}) as Record<string, unknown>) || {};
  const redes = ((raw.redes_sociais ?? {}) as Record<string, unknown>) || {};

  return {
    badge: cleanText(raw.badge ?? defaults?.badge, 80),
    headline: cleanText(raw.headline ?? defaults?.headline, 140),
    descricao: cleanText(raw.descricao ?? defaults?.descricao, 700),
    banner_url: cleanText(raw.banner_url ?? defaults?.banner_url, 600),
    instrucoes: cleanText(raw.instrucoes ?? defaults?.instrucoes, 1000),
    contactos: {
      whatsapp: cleanText(contactos.whatsapp ?? defaults?.contactos?.whatsapp, 80),
      telefone: cleanText(contactos.telefone ?? defaults?.contactos?.telefone, 80),
      email: cleanText(contactos.email ?? defaults?.contactos?.email, 180).toLowerCase(),
      endereco: cleanText(contactos.endereco ?? defaults?.contactos?.endereco, 240),
    },
    redes_sociais: {
      instagram: cleanText(redes.instagram ?? defaults?.redes_sociais?.instagram, 240),
      facebook: cleanText(redes.facebook ?? defaults?.redes_sociais?.facebook, 240),
      linkedin: cleanText(redes.linkedin ?? defaults?.redes_sociais?.linkedin, 240),
      website: cleanText(redes.website ?? defaults?.redes_sociais?.website, 240),
    },
    faq: normalizeFaq(raw.faq ?? defaults?.faq),
  };
}

function hasRecebimentosAtivos(input: unknown) {
  const dados = (input ?? {}) as Record<string, unknown>;
  return Boolean(dados.ativo) && Boolean(dados.iban || dados.numero_conta || dados.kwik_chave);
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const escolaId = String(auth.escolaId);

  const [{ data: centro, error: centroError }, { data: cursos, error: cursosError }, { data: cohorts, error: cohortsError }] =
    await Promise.all([
      s
        .from("centros_formacao")
        .select("landing_config,dados_pagamento,nome,telefone,email,website,morada,municipio,provincia,logo_url")
        .eq("escola_id", escolaId)
        .maybeSingle(),
      s
        .from("formacao_cursos")
        .select("id,nome,status")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true })
        .limit(300),
      s
        .from("formacao_cohorts")
        .select("id,codigo,nome,curso_nome,status,vagas,data_inicio")
        .eq("escola_id", escolaId)
        .order("data_inicio", { ascending: true })
        .limit(300),
    ]);

  if (centroError) return NextResponse.json({ ok: false, error: centroError.message }, { status: 400 });
  if (cursosError) return NextResponse.json({ ok: false, error: cursosError.message }, { status: 400 });
  if (cohortsError) return NextResponse.json({ ok: false, error: cohortsError.message }, { status: 400 });

  const cohortIds = (cohorts ?? []).map((cohort) => String(cohort.id));
  const [financeiroRes, inscricoesRes] = cohortIds.length
    ? await Promise.all([
        s
          .from("formacao_cohort_financeiro")
          .select("cohort_id,valor_referencia,moeda")
          .eq("escola_id", escolaId)
          .in("cohort_id", cohortIds),
        s
          .from("formacao_inscricoes")
          .select("cohort_id,estado,cancelled_at")
          .eq("escola_id", escolaId)
          .in("cohort_id", cohortIds)
          .in("estado", ["pre_inscrito", "inscrito"])
          .is("cancelled_at", null)
          .limit(2000),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (financeiroRes.error) return NextResponse.json({ ok: false, error: financeiroRes.error.message }, { status: 400 });
  if (inscricoesRes.error) return NextResponse.json({ ok: false, error: inscricoesRes.error.message }, { status: 400 });

  const typedCentro = (centro ?? {}) as Record<string, unknown>;
  const defaults = normalizeConfig(
    {},
    {
      contactos: {
        whatsapp: "",
        telefone: String(typedCentro.telefone ?? ""),
        email: String(typedCentro.email ?? ""),
        endereco: String(typedCentro.morada ?? ""),
      },
      redes_sociais: {
        instagram: "",
        facebook: "",
        linkedin: "",
        website: String(typedCentro.website ?? ""),
      },
    }
  );
  const landingConfig = normalizeConfig(typedCentro.landing_config, defaults);
  const recebimentosAtivos = hasRecebimentosAtivos(typedCentro.dados_pagamento);

  const cursoStatusByNome = new Map((cursos ?? []).map((curso) => [String(curso.nome), String(curso.status)]));
  const financeiroByCohort = new Map<string, { valor_referencia: number; moeda: string }>(
    (financeiroRes.data ?? []).map((row): [string, { valor_referencia: number; moeda: string }] => {
      const item = row as { cohort_id: string; valor_referencia: number | null; moeda: string | null };
      return [String(item.cohort_id), { valor_referencia: Number(item.valor_referencia ?? 0), moeda: item.moeda ?? "AOA" }];
    })
  );
  const ocupacaoByCohort = new Map<string, number>();
  for (const row of inscricoesRes.data ?? []) {
    const key = String((row as { cohort_id: string }).cohort_id);
    ocupacaoByCohort.set(key, (ocupacaoByCohort.get(key) ?? 0) + 1);
  }

  const readiness = (cohorts ?? []).map((cohort) => {
    const id = String(cohort.id);
    const vagas = Number(cohort.vagas ?? 0);
    const ocupadas = ocupacaoByCohort.get(id) ?? 0;
    const financeiro = financeiroByCohort.get(id) ?? { valor_referencia: 0, moeda: "AOA" };
    const checks = {
      curso_ativo: cursoStatusByNome.get(String(cohort.curso_nome)) === "ativo",
      turma_aberta: String(cohort.status) === "aberta",
      preco_configurado: financeiro.valor_referencia > 0,
      vagas_disponiveis: vagas <= 0 ? true : ocupadas < vagas,
      recebimentos_ativos: recebimentosAtivos,
    };

    return {
      id,
      codigo: cohort.codigo,
      nome: cohort.nome,
      curso_nome: cohort.curso_nome,
      status: cohort.status,
      vagas,
      vagas_ocupadas: ocupadas,
      valor_referencia: financeiro.valor_referencia,
      moeda: financeiro.moeda,
      data_inicio: cohort.data_inicio,
      checks,
      pronto: Object.values(checks).every(Boolean),
    };
  });

  return NextResponse.json({
    ok: true,
    item: landingConfig,
    centro: {
      nome: typedCentro.nome ?? null,
      logo_url: typedCentro.logo_url ?? null,
      municipio: typedCentro.municipio ?? null,
      provincia: typedCentro.provincia ?? null,
    },
    readiness,
  });
}

export async function PUT(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const item = normalizeConfig((body as { item?: unknown } | null)?.item ?? body);

  const s = auth.supabase as FormacaoSupabaseClient & {
    rpc: (
      fn: "formacao_update_landing_config",
      args: { p_escola_id: string; p_config: LandingConfig }
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await s.rpc("formacao_update_landing_config", {
    p_escola_id: String(auth.escolaId),
    p_config: item,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: normalizeConfig(data) });
}
