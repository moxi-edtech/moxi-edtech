import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

type InscricaoPayload = {
  cohort_id?: string;
  formando_user_id?: string;
  email?: string;
  bi_numero?: string;
  telefone?: string;
  nome?: string;
  origem?: "balcao" | "b2b_upload" | "self_service";
  modalidade?: "presencial" | "online_live" | "online_gravado";
  valor_cobrado?: number;
  criar_cobranca?: boolean;
  descricao_cobranca?: string;
  vencimento_em?: string;
  password_provisoria?: string;
};

function normalizeBi(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function buildReference(prefix: string, escolaId: string) {
  const stamp = Date.now().toString().slice(-8);
  return `${prefix}-${escolaId.slice(0, 5).toUpperCase()}-${stamp}`;
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const size = 14;
  let value = "";
  for (let i = 0; i < size; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    value += alphabet[idx];
  }
  return value;
}

async function ensureConsumidorFinal(s: FormacaoSupabaseClient, escolaId: string) {
  const { data: existing } = await s
    .from("formacao_clientes_b2b")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("nome_fantasia", "Consumidor Final")
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .insert({
      escola_id: escolaId,
      nome_fantasia: "Consumidor Final",
      status: "ativo",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function resolveFormandoUserId(
  s: FormacaoSupabaseClient,
  escolaId: string,
  payload: InscricaoPayload
) {
  const directUserId = String(payload.formando_user_id ?? "").trim();
  if (directUserId) return directUserId;

  const email = String(payload.email ?? "").trim().toLowerCase();
  const telefone = String(payload.telefone ?? "").trim();
  const biRaw = String(payload.bi_numero ?? "").trim();
  const biNorm = normalizeBi(biRaw);

  if (!email && !telefone && !biNorm) return null;

  let query = s
    .from("profiles")
    .select("user_id, email, telefone, bi_numero")
    .eq("escola_id", escolaId)
    .limit(200);

  if (email) query = query.eq("email", email);
  const { data, error } = await query;
  if (error) throw error;

  const candidates = (data ?? []).filter((row) => {
    const biMatches = !biNorm || normalizeBi(String(row.bi_numero ?? "")) === biNorm;
    const telMatches = !telefone || String(row.telefone ?? "").trim() === telefone;
    return biMatches && telMatches;
  });

  if (candidates.length === 1) return String(candidates[0].user_id);
  if (candidates.length > 1) return "__AMBIGUOUS__";
  return null;
}

async function findFormandoCandidates(
  s: FormacaoSupabaseClient,
  escolaId: string,
  payload: InscricaoPayload
) {
  const email = String(payload.email ?? "").trim().toLowerCase();
  const telefone = String(payload.telefone ?? "").trim();
  const biNorm = normalizeBi(String(payload.bi_numero ?? "").trim());

  if (!email && !telefone && !biNorm) return [];

  let query = s
    .from("profiles")
    .select("user_id, nome, email, telefone, bi_numero")
    .eq("escola_id", escolaId)
    .limit(20);

  if (email) query = query.eq("email", email);
  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      const biMatches = !biNorm || normalizeBi(String(row.bi_numero ?? "")) === biNorm;
      const telMatches = !telefone || String(row.telefone ?? "").trim() === telefone;
      return biMatches && telMatches;
    })
    .map((row) => {
      const typed = row as {
        user_id: string;
        nome: string | null;
        email: string | null;
        telefone: string | null;
        bi_numero: string | null;
      };
      return {
        user_id: String(typed.user_id),
        nome: typed.nome ?? "Sem nome",
        email: typed.email,
        telefone: typed.telefone,
        bi_numero: typed.bi_numero,
        label: [typed.nome ?? "Sem nome", typed.email ?? "", typed.telefone ?? "", typed.bi_numero ?? ""]
          .filter(Boolean)
          .join(" · "),
      };
    });
}

async function assertCohortInTenant(s: FormacaoSupabaseClient, escolaId: string, cohortId: string) {
  const { data, error } = await s
    .from("formacao_cohorts")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", cohortId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function assertFormandoInTenant(s: FormacaoSupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await s
    .from("alunos")
    .select("id")
    .eq("escola_id", escolaId)
    .or(`usuario_auth_id.eq.${userId},profile_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const cohortId = url.searchParams.get("cohort_id")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
  const s = auth.supabase as FormacaoSupabaseClient;

  let query = s
    .from("formacao_inscricoes")
    .select(
      "id, cohort_id, formando_user_id, origem, estado, status_pagamento, modalidade, valor_cobrado, nome_snapshot, email_snapshot, bi_snapshot, telefone_snapshot, created_at"
    )
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cohortId) query = query.eq("cohort_id", cohortId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as InscricaoPayload | null;
  const cohortId = String(body?.cohort_id ?? "").trim();
  const origem = body?.origem ?? "balcao";
  const modalidade = body?.modalidade ?? undefined;
  const valorCobrado = Number(body?.valor_cobrado ?? 0);
  const criarCobranca = Boolean(body?.criar_cobranca);
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const descricaoCobranca = String(body?.descricao_cobranca ?? "Inscrição em cohort").trim();
  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const biNumero = String(body?.bi_numero ?? "").trim();
  const telefone = String(body?.telefone ?? "").trim();
  const passwordProvisoriaInput = String(body?.password_provisoria ?? "").trim();

  if (!cohortId) {
    return NextResponse.json({ ok: false, error: "cohort_id é obrigatório" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ ok: false, error: "nome é obrigatório" }, { status: 400 });
  }

  if (valorCobrado < 0) {
    return NextResponse.json({ ok: false, error: "valor_cobrado inválido" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  try {
    const cohortExists = await assertCohortInTenant(s, String(auth.escolaId), cohortId);
    if (!cohortExists) {
      return NextResponse.json({ ok: false, error: "cohort_id inválido para esta escola" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao validar turma";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  let formandoUserId: string | null = null;
  let createdNewUser = false;
  let generatedPassword: string | null = null;
  try {
    formandoUserId = await resolveFormandoUserId(s, String(auth.escolaId), body ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao resolver formando";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (formandoUserId === "__AMBIGUOUS__") {
    const candidates = await findFormandoCandidates(s, String(auth.escolaId), body ?? {});
    return NextResponse.json(
      {
        ok: false,
        error: "Foram encontrados múltiplos formandos compatíveis. Selecione um candidato para continuar.",
        code: "FORMANDO_RESOLUTION_REQUIRED",
        resolution: {
          mode: "select_candidate",
          candidates,
        },
      },
      { status: 409 }
    );
  }

  if (!formandoUserId && !email) {
    return NextResponse.json(
      { ok: false, error: "email é obrigatório para criar novo formando automaticamente" },
      { status: 400 }
    );
  }

  if (!formandoUserId) {
    generatedPassword = passwordProvisoriaInput.length >= 8 ? passwordProvisoriaInput : generateTemporaryPassword();
    const { data: signUpData, error: signUpError } = await s.auth.signUp({
      email,
      password: generatedPassword,
      options: {
        data: {
          nome,
          role: "formando",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      },
    });

    if (signUpError) {
      const message = signUpError.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        const { data: existingByEmail, error: lookupError } = await s
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .limit(2);

        if (lookupError) {
          return NextResponse.json({ ok: false, error: lookupError.message }, { status: 400 });
        }
        if ((existingByEmail ?? []).length === 1) {
          formandoUserId = String(existingByEmail?.[0]?.user_id ?? "").trim() || null;
        }
      } else {
        return NextResponse.json({ ok: false, error: signUpError.message }, { status: 400 });
      }
    } else {
      formingUserIdFromSignUp: {
        const userId = String(signUpData.user?.id ?? "").trim();
        if (!userId) break formingUserIdFromSignUp;
        formandoUserId = userId;
        createdNewUser = true;
      }
    }
  }

  if (!formandoUserId) {
    const candidates = await findFormandoCandidates(s, String(auth.escolaId), body ?? {});
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível identificar o formando automaticamente. Revise os dados e selecione um candidato.",
        code: "FORMANDO_RESOLUTION_REQUIRED",
        resolution: {
          mode: "review_or_select",
          candidates,
          required_fields: ["nome", "email|bi_numero|telefone"],
        },
      },
      { status: 409 }
    );
  }

  if (String(body?.formando_user_id ?? "").trim()) {
    try {
      const isInTenant = await assertFormandoInTenant(s, String(auth.escolaId), String(formandoUserId));
      if (!isInTenant) {
        return NextResponse.json({ ok: false, error: "formando_user_id inválido para esta escola" }, { status: 400 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao validar formando";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const { data: perfil, error: perfilError } = await (s as FormacaoSupabaseClient & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("formacao_upsert_formando_profile", {
    p_escola_id: auth.escolaId,
    p_user_id: formandoUserId,
    p_nome: nome,
    p_email: email || null,
    p_bi_numero: biNumero || null,
    p_telefone: telefone || null,
  });

  if (perfilError) {
    if (perfilError.message.includes("BI_ALREADY_EXISTS")) {
      return NextResponse.json({ ok: false, error: "BI já existe para outro formando deste centro" }, { status: 409 });
    }
    if (perfilError.message.includes("PROFILE_OWNED_BY_OTHER_SCHOOL")) {
      return NextResponse.json(
        { ok: false, error: "Perfil já está vinculado a outra escola/tenant" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: perfilError.message }, { status: 400 });
  }

  const { data: inscricao, error: inscricaoError } = await (s as FormacaoSupabaseClient & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("formacao_create_inscricao", {
    p_escola_id: auth.escolaId,
    p_cohort_id: cohortId,
    p_formando_user_id: formandoUserId,
    p_origem: origem,
    p_modalidade: modalidade,
    p_created_by: auth.userId,
    p_nome_snapshot: nome || null,
    p_email_snapshot: email || null,
    p_bi_snapshot: biNumero || null,
    p_telefone_snapshot: telefone || null,
    p_valor_cobrado: valorCobrado,
  });

  if (inscricaoError) {
    if (inscricaoError.message.includes("TURMA_ESGOTADA")) {
      return NextResponse.json({ ok: false, error: "Turma esgotada para modalidade presencial" }, { status: 409 });
    }
    if (inscricaoError.message.includes("COHORT_NOT_FOUND")) {
      return NextResponse.json({ ok: false, error: "Cohort não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: inscricaoError.message }, { status: 400 });
  }

  let cobranca: Record<string, unknown> | null = null;
  if (criarCobranca && valorCobrado > 0) {
    if (!vencimentoEm) {
      return NextResponse.json(
        { ok: false, error: "vencimento_em é obrigatório quando criar_cobranca=true" },
        { status: 400 }
      );
    }

    try {
      const clienteId = await ensureConsumidorFinal(s, String(auth.escolaId));
      const referencia = buildReference("B2C", String(auth.escolaId));

      const { data: fatura, error: faturaErr } = await s
        .from("formacao_faturas_lote")
        .insert({
          escola_id: auth.escolaId,
          cliente_b2b_id: clienteId,
          cohort_id: cohortId,
          referencia,
          vencimento_em: vencimentoEm,
          total_bruto: valorCobrado,
          total_desconto: 0,
          status: "emitida",
          created_by: auth.userId,
        })
        .select("id, referencia, total_liquido, status")
        .single();

      if (faturaErr) {
        return NextResponse.json({ ok: false, error: faturaErr.message }, { status: 400 });
      }

      const { data: item, error: itemErr } = await s
        .from("formacao_faturas_lote_itens")
        .insert({
          escola_id: auth.escolaId,
          fatura_lote_id: fatura.id,
          formando_user_id: formandoUserId,
          descricao: descricaoCobranca,
          quantidade: 1,
          preco_unitario: valorCobrado,
          desconto: 0,
          status_pagamento: "pendente",
        })
        .select("id, valor_total, status_pagamento")
        .single();

      if (itemErr) {
        return NextResponse.json({ ok: false, error: itemErr.message }, { status: 400 });
      }

      cobranca = { fatura, item };
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Falha ao gerar cobrança" },
        { status: 400 }
      );
    }
  }

  // Disparo de E-mail de Credenciais
  if (createdNewUser && generatedPassword && email) {
    try {
      const { data: cohortData } = await s
        .from("formacao_cohorts")
        .select("nome, curso_nome")
        .eq("id", cohortId)
        .single();
        
      const { data: escolaData } = await s
        .from("escolas")
        .select("nome")
        .eq("id", auth.escolaId)
        .single();

      if (cohortData && escolaData) {
        const emailContent = buildFormacaoCredentialsEmail({
          nome,
          email,
          senha_temp: generatedPassword,
          escolaNome: escolaData.nome,
          cursoNome: cohortData.curso_nome,
          cohortNome: cohortData.nome,
        });

        await sendMail({
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }
    } catch (mailErr) {
      console.error("Falha ao enviar e-mail de credenciais:", mailErr);
      // Não bloqueia a inscrição se o e-mail falhar, pois o processo já foi concluído
    }
  }

  console.info(
    JSON.stringify({
      event: createdNewUser ? "enrollment_created_with_user" : "enrollment_created_existing_user",

      escola_id: auth.escolaId,
      cohort_id: cohortId,
      user_id: formandoUserId,
      timestamp: new Date().toISOString(),
    })
  );

  return NextResponse.json({
    ok: true,
    inscricao,
    perfil,
    cobranca,
    credentials:
      createdNewUser && generatedPassword
        ? {
            email,
            temporary_password: generatedPassword,
            must_change_password: true,
          }
        : null,
  });
}
