import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type PublicOnboardingPayload = {
  escola_nome?: string;
  escola_nif?: string;
  escola_abrev?: string;
  escola_codigo?: string;
  escola_morada?: string;
  escola_municipio?: string;
  escola_provincia?: string;
  escola_tel?: string;
  escola_email?: string;
  director_nome?: string;
  director_tel?: string;
  ano_letivo?: string;
  classes?: unknown;
  turnos?: unknown;
  faixa_propina?: string;
  total_alunos?: string | number;
  plano_interesse?: string;
  commercial?: {
    trial_days?: string | number;
    taxa_ativacao?: string | number;
    mensalidade_kz?: string | number;
    curriculum_preset?: string | null;
  };
  financeiro?: Record<string, unknown>;
  utilizadores?: {
    principal?: {
      nome?: string;
      tel?: string;
      nivel_exp?: string;
    };
  };
  parceiro_ref?: string;
};

const VALID_PLANS = new Set(["essencial", "profissional", "premium"]);
const VALID_PRESETS = new Set([
  "pre_escolar",
  "primario_generico",
  "esg_ciclo1",
  "esg_puniv_cfb",
  "esg_puniv_cej",
  "esg_puniv_cch",
  "tec_informatica",
  "tec_contabilidade",
  "tec_informatica_gestao",
  "tec_saude_enfermagem",
  "tec_saude_analises",
]);

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, fallback: number, options?: { min?: number; max?: number }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const min = options?.min ?? Number.MIN_SAFE_INTEGER;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function planLabel(plan: string) {
  if (plan === "profissional") return "Profissional";
  if (plan === "premium") return "Premium";
  return "Essencial";
}

function normalizeClasses(classes: unknown) {
  return Array.isArray(classes) ? classes : [];
}

function normalizeTurnos(turnos: unknown) {
  return Array.isArray(turnos) ? turnos : [];
}

function inferNiveisEnsino(classes: unknown[]) {
  const activeClasses = classes.filter((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as { activa?: unknown }).activa !== false;
  });
  const niveis = new Set<string>();
  for (const item of activeClasses) {
    const nivel = String((item as { nivel?: unknown }).nivel ?? "").toUpperCase();
    const id = String((item as { id?: unknown }).id ?? "");
    if (nivel === "EP") niveis.add("primario");
    if (nivel === "ESG") {
      const numericId = Number(id);
      if (numericId >= 7 && numericId <= 9) niveis.add("ciclo1");
      if (numericId >= 10) niveis.add("puniv");
    }
  }
  return Array.from(niveis);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as PublicOnboardingPayload | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const escolaNome = text(body.escola_nome);
    const escolaNif = text(body.escola_nif, 32);
    const planoInteresse = VALID_PLANS.has(text(body.plano_interesse, 32))
      ? text(body.plano_interesse, 32)
      : "";
    const totalAlunos = integer(body.total_alunos, 0, { min: 0 });
    const trialDays = integer(body.commercial?.trial_days, 15, { min: 0, max: 30 });
    const taxaAtivacao = integer(body.commercial?.taxa_ativacao, 50000, { min: 0 });
    const mensalidadeKz = integer(body.commercial?.mensalidade_kz, 0, { min: 0 });
    const curriculumPresetRaw = text(body.commercial?.curriculum_preset, 80);
    const curriculumPreset = VALID_PRESETS.has(curriculumPresetRaw) ? curriculumPresetRaw : null;

    if (!escolaNome) {
      return NextResponse.json({ ok: false, error: "Nome da escola é obrigatório." }, { status: 400 });
    }
    if (!escolaNif) {
      return NextResponse.json({ ok: false, error: "NIF da escola é obrigatório." }, { status: 400 });
    }
    if (!planoInteresse) {
      return NextResponse.json({ ok: false, error: "Plano de interesse é obrigatório." }, { status: 400 });
    }
    if (taxaAtivacao <= 0) {
      return NextResponse.json({ ok: false, error: "A taxa de ativação precisa ser maior que zero." }, { status: 400 });
    }

    const classes = normalizeClasses(body.classes);
    const turnos = normalizeTurnos(body.turnos);
    const parceiroRef = text(body.parceiro_ref, 32).toUpperCase();
    const principal = body.utilizadores?.principal ?? {};
    const contactoPrincipal = {
      nome: text(principal.nome),
      telefone: text(principal.tel, 64),
      email: text(body.escola_email, 160),
    };

    const financeiro = {
      ...(body.financeiro && typeof body.financeiro === "object" ? body.financeiro : {}),
      total_alunos: String(totalAlunos || ""),
      plano_interesse: planoInteresse,
      plano_interesse_label: planLabel(planoInteresse),
      origem_campanha: parceiroRef ? "influencer_escola_moderna" : "onboarding_publico",
      onboarding_source: "public_form",
      influencer_codigo: parceiroRef || null,
      trial_days: trialDays,
      taxa_ativacao: taxaAtivacao,
      mensalidade_kz: mensalidadeKz,
      commercial_status: "rascunho",
      curriculum_preset: curriculumPreset,
    };

    const supabase = await supabaseRouteClient();
    const { error } = await supabase.from("onboarding_requests").insert({
      escola_nome: escolaNome,
      escola_nif: escolaNif,
      escola_abrev: text(body.escola_abrev, 32),
      escola_codigo: text(body.escola_codigo, 64),
      escola_morada: text(body.escola_morada, 320),
      escola_municipio: text(body.escola_municipio, 120),
      escola_provincia: text(body.escola_provincia, 120) || "Luanda",
      escola_tel: text(body.escola_tel, 64),
      escola_email: text(body.escola_email, 160),
      director_nome: text(body.director_nome, 160),
      director_tel: text(body.director_tel, 64),
      ano_letivo: text(body.ano_letivo, 16) || "2026",
      classes: classes as any,
      turnos: turnos as any,
      faixa_propina: text(body.faixa_propina, 64),
      financeiro: financeiro as any,
      utilizadores: {
        ...(body.utilizadores && typeof body.utilizadores === "object" ? body.utilizadores : {}),
        principal: {
          nome: text(principal.nome),
          tel: text(principal.tel, 64),
          nivel_exp: text(principal.nivel_exp, 80),
        },
      } as any,
      status: "pendente",
      notas_admin: `Pedido criado pelo formulário público de onboarding${parceiroRef ? ` com referência ${parceiroRef}` : ""}.`,
      curriculum_preset: curriculumPreset,
      niveis_ensino: inferNiveisEnsino(classes) as any,
      contacto_secretaria: contactoPrincipal as any,
      contacto_financeiro: contactoPrincipal as any,
      contacto_pedagogico: {
        nome: text(body.director_nome, 160) || contactoPrincipal.nome,
        telefone: text(body.director_tel, 64) || contactoPrincipal.telefone,
        email: contactoPrincipal.email,
      } as any,
    } as any);

    if (error) {
      console.error("public onboarding submit failed", error);
      return NextResponse.json({ ok: false, error: "Falha ao registar o pedido de onboarding." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
