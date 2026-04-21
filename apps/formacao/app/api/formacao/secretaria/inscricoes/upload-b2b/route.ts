import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formacao_financeiro",
  "super_admin",
  "global_admin",
];

type UploadRow = {
  nome?: string;
  email?: string;
  bi_numero?: string;
  telefone?: string;
  valor_cobrado?: number;
};

type UploadPayload = {
  cohort_id?: string;
  cliente_b2b_id?: string;
  cliente_nome?: string;
  vencimento_em?: string;
  descricao_cobranca?: string;
  valor_cobrado_padrao?: number;
  criar_cobranca?: boolean;
  rows?: UploadRow[];
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

async function resolveFormandoUserId(
  s: FormacaoSupabaseClient,
  escolaId: string,
  row: UploadRow
) {
  const email = String(row.email ?? "").trim().toLowerCase();
  const telefone = String(row.telefone ?? "").trim();
  const biNorm = normalizeBi(String(row.bi_numero ?? "").trim());

  if (!email && !telefone && !biNorm) return null;

  let query = s
    .from("profiles")
    .select("user_id, email, telefone, bi_numero")
    .eq("escola_id", escolaId)
    .limit(200);

  if (email) query = query.eq("email", email);
  const { data, error } = await query;
  if (error) throw error;

  const candidates = (data ?? []).filter((profile) => {
    const biMatches = !biNorm || normalizeBi(String(profile.bi_numero ?? "")) === biNorm;
    const telMatches = !telefone || String(profile.telefone ?? "").trim() === telefone;
    return biMatches && telMatches;
  });

  if (candidates.length === 1) return String(candidates[0].user_id);
  if (candidates.length > 1) return "__AMBIGUOUS__";
  return null;
}

async function ensureB2BClient(s: FormacaoSupabaseClient, escolaId: string, nome: string) {
  const normalizedName = String(nome).trim();
  if (!normalizedName) throw new Error("cliente_nome é obrigatório quando cliente_b2b_id não é informado");

  const { data: existing } = await s
    .from("formacao_clientes_b2b")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("nome_fantasia", normalizedName)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .insert({
      escola_id: escolaId,
      nome_fantasia: normalizedName,
      status: "ativo",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as UploadPayload | null;
  const cohortId = String(body?.cohort_id ?? "").trim();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const criarCobranca = body?.criar_cobranca !== false;
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const descricaoCobranca = String(body?.descricao_cobranca ?? "Inscrição em cohort (B2B)").trim();
  const valorPadrao = Math.max(0, Number(body?.valor_cobrado_padrao ?? 0));
  const clienteB2bIdInput = String(body?.cliente_b2b_id ?? "").trim();
  const clienteNome = String(body?.cliente_nome ?? "").trim();
  const s = auth.supabase as FormacaoSupabaseClient;

  if (!cohortId) {
    return NextResponse.json({ ok: false, error: "cohort_id é obrigatório" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "rows deve conter ao menos 1 formando" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ ok: false, error: "rows excede limite de 500 por lote" }, { status: 400 });
  }
  if (criarCobranca && !vencimentoEm) {
    return NextResponse.json({ ok: false, error: "vencimento_em é obrigatório quando criar_cobranca=true" }, { status: 400 });
  }

  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];
  const successfulForBilling: Array<{ formandoUserId: string; valor: number; nome: string }> = [];
  const credentials: Array<{ email: string; temporary_password: string; must_change_password: true }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? {};
    const nome = String(row.nome ?? "").trim();
    const email = String(row.email ?? "").trim().toLowerCase();
    const biNumero = String(row.bi_numero ?? "").trim();
    const telefone = String(row.telefone ?? "").trim();
    const valorCobrado = Math.max(0, Number(row.valor_cobrado ?? valorPadrao));

    const dedupKey = `${email}|${normalizeBi(biNumero)}|${telefone}`.trim();
    if (seen.has(dedupKey)) {
      results.push({ index, status: "error", code: "DUPLICATE_IN_PAYLOAD", error: "Linha duplicada no mesmo lote" });
      continue;
    }
    seen.add(dedupKey);

    if (!nome) {
      results.push({ index, status: "error", code: "INVALID_ROW", error: "nome é obrigatório" });
      continue;
    }
    if (!email && !biNumero && !telefone) {
      results.push({ index, status: "error", code: "INVALID_ROW", error: "informar ao menos email, bi_numero ou telefone" });
      continue;
    }

    try {
      let formingUserId = await resolveFormandoUserId(s, String(auth.escolaId), row);
      let createdNewUser = false;
      let tempPassword: string | null = null;

      if (formingUserId === "__AMBIGUOUS__") {
        results.push({
          index,
          status: "error",
          code: "AMBIGUOUS_USER",
          error: "Mais de um utilizador compatível encontrado para esta linha",
        });
        continue;
      }

      if (!formingUserId) {
        if (!email) {
          results.push({
            index,
            status: "error",
            code: "EMAIL_REQUIRED_FOR_CREATE",
            error: "email obrigatório para criação automática de utilizador",
          });
          continue;
        }

        tempPassword = generateTemporaryPassword();
        const { data: signUpData, error: signUpError } = await s.auth.signUp({
          email,
          password: tempPassword,
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
              results.push({ index, status: "error", code: "LOOKUP_FAILED", error: lookupError.message });
              continue;
            }
            if ((existingByEmail ?? []).length === 1) {
              formingUserId = String(existingByEmail?.[0]?.user_id ?? "").trim() || null;
            } else {
              results.push({
                index,
                status: "error",
                code: "EMAIL_ALREADY_EXISTS",
                error: "email já existe e não foi possível resolver utilizador único",
              });
              continue;
            }
          } else {
            results.push({ index, status: "error", code: "AUTH_SIGNUP_FAILED", error: signUpError.message });
            continue;
          }
        } else {
          const createdId = String(signUpData.user?.id ?? "").trim();
          if (!createdId) {
            results.push({ index, status: "error", code: "AUTH_SIGNUP_EMPTY", error: "Auth retornou utilizador inválido" });
            continue;
          }
          formingUserId = createdId;
          createdNewUser = true;
        }
      }

      if (!formingUserId) {
        results.push({ index, status: "error", code: "USER_NOT_RESOLVED", error: "Não foi possível resolver utilizador" });
        continue;
      }

      const { error: perfilError } = await (s as FormacaoSupabaseClient & {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc("formacao_upsert_formando_profile", {
        p_escola_id: auth.escolaId,
        p_user_id: formingUserId,
        p_nome: nome,
        p_email: email || null,
        p_bi_numero: biNumero || null,
        p_telefone: telefone || null,
      });

      if (perfilError) {
        results.push({ index, status: "error", code: "PROFILE_UPSERT_FAILED", error: perfilError.message });
        continue;
      }

      const { error: inscricaoError } = await (s as FormacaoSupabaseClient & {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc("formacao_create_inscricao", {
        p_escola_id: auth.escolaId,
        p_cohort_id: cohortId,
        p_formando_user_id: formingUserId,
        p_origem: "b2b_upload",
        p_created_by: auth.userId,
        p_nome_snapshot: nome || null,
        p_email_snapshot: email || null,
        p_bi_snapshot: biNumero || null,
        p_telefone_snapshot: telefone || null,
        p_valor_cobrado: valorCobrado,
      });

      if (inscricaoError) {
        results.push({ index, status: "error", code: "ENROLLMENT_FAILED", error: inscricaoError.message });
        continue;
      }

      successfulForBilling.push({ formandoUserId: formingUserId, valor: valorCobrado, nome });

      if (createdNewUser && tempPassword && email) {
        credentials.push({ email, temporary_password: tempPassword, must_change_password: true });
      }

      results.push({
        index,
        status: "ok",
        created_user: createdNewUser,
        user_id: formingUserId,
        valor_cobrado: valorCobrado,
      });
    } catch (error) {
      results.push({
        index,
        status: "error",
        code: "UNEXPECTED",
        error: error instanceof Error ? error.message : "Erro inesperado",
      });
    }
  }

  let cobranca: Record<string, unknown> | null = null;
  let cobrancaError: string | null = null;
  if (criarCobranca && successfulForBilling.length > 0) {
    try {
      let clienteId = clienteB2bIdInput;
      if (!clienteId) {
        clienteId = await ensureB2BClient(s, String(auth.escolaId), clienteNome || "Cliente B2B");
      }

      const referencia = buildReference("B2B", String(auth.escolaId));
      const totalBruto = successfulForBilling.reduce((sum, item) => sum + item.valor, 0);

      const { data: fatura, error: faturaErr } = await s
        .from("formacao_faturas_lote")
        .insert({
          escola_id: auth.escolaId,
          cliente_b2b_id: clienteId,
          cohort_id: cohortId,
          referencia,
          vencimento_em: vencimentoEm,
          total_bruto: totalBruto,
          total_desconto: 0,
          status: "emitida",
          created_by: auth.userId,
        })
        .select("id, referencia, total_liquido, status")
        .single();

      if (faturaErr) throw new Error(faturaErr.message);

      const itens = successfulForBilling.map((item) => ({
        escola_id: auth.escolaId,
        fatura_lote_id: fatura.id,
        formando_user_id: item.formandoUserId,
        descricao: descricaoCobranca,
        quantidade: 1,
        preco_unitario: item.valor,
        desconto: 0,
        status_pagamento: "pendente",
      }));

      const { error: itemErr } = await s.from("formacao_faturas_lote_itens").insert(itens);
      if (itemErr) throw new Error(itemErr.message);
      cobranca = { fatura, itens_total: itens.length };
    } catch (error) {
      cobrancaError = error instanceof Error ? error.message : "Falha ao gerar cobrança B2B";
    }
  }

  const total = rows.length;
  const success = results.filter((item) => item.status === "ok").length;
  const failed = total - success;

  console.info(
    JSON.stringify({
      event: "b2b_import_completed",
      escola_id: auth.escolaId,
      cohort_id: cohortId,
      total,
      success,
      failed,
      generated_invoice: Boolean(cobranca),
      timestamp: new Date().toISOString(),
    })
  );

  return NextResponse.json({
    ok: failed === 0,
    resumo: { total, success, failed },
    resultados: results,
    credentials,
    cobranca,
    cobranca_error: cobrancaError,
  });
}
