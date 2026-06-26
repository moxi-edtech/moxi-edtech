import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createActivationToken } from "@/lib/activationLink";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type OutboxEvent = {
  id: string;
  escola_id: string;
  event_type: string;
  dedupe_key?: string | null;
  idempotency_key?: string | null;
  payload: Record<string, any> | null;
  status: string;
  attempts: number;
  max_attempts?: number | null;
  next_attempt_at: string;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
};

type PagamentoRow = {
  id: string;
  escola_id: string;
  aluno_id: string | null;
  mensalidade_id: string | null;
  valor_pago: number | null;
  data_pagamento: string | null;
  metodo: string | null;
  reference: string | null;
};

type NotificationOutboxRow = {
  id: string;
  escola_id: string;
  aluno_id: string;
  canal: string;
  destino: string | null;
  mensagem: string | null;
  status: string;
  request_id: string;
};

function resolveJobToken(req: Request) {
  return req.headers.get("x-job-token") || req.headers.get("authorization")?.replace("Bearer ", "");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function markEvent(
  admin: ReturnType<typeof getAdminClient>,
  event: OutboxEvent,
  status: "sent" | "failed",
  lastError?: string | null
) {
  if (!admin) return;
  const attempts = event.attempts ?? 0;
  const maxAttempts = event.max_attempts ?? 5;
  const shouldDead = status === "failed" && attempts >= maxAttempts;
  const backoffMinutes = Math.min(60, Math.pow(2, Math.max(0, attempts))) * 5;
  const { error } = await admin
    .from("outbox_events")
    .update({
      status: shouldDead ? "dead" : status,
      processed_at: status === "sent" ? new Date().toISOString() : null,
      last_error: lastError ?? null,
      next_attempt_at:
        status === "failed" && !shouldDead
          ? new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
          : null,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", event.id);

  if (error) throw error;
}

function normalizeWhatsappChatId(rawPhone: string | null | undefined) {
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountryCode = digits.startsWith("244") ? digits : `244${digits.replace(/^0+/, "")}`;
  if (withCountryCode.length < 11 || withCountryCode.length > 15) return null;
  return `${withCountryCode}@c.us`;
}

function extractWahaMessageId(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const id = record.id;
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    const idRecord = id as Record<string, unknown>;
    const serialized = idRecord._serialized ?? idRecord.serialized;
    if (typeof serialized === "string") return serialized;
    if (typeof idRecord.id === "string") return idRecord.id;
  }
  const key = record.key;
  if (key && typeof key === "object") {
    const keyRecord = key as Record<string, unknown>;
    if (typeof keyRecord.id === "string") return keyRecord.id;
  }
  return null;
}

async function getConnectedWahaProvider(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  escolaId: string
) {
  const { data, error } = await admin
    .from("school_notification_providers")
    .select("session_name,status,daily_limit")
    .eq("school_id", escolaId)
    .eq("provider_type", "whatsapp_waha")
    .maybeSingle();

  if (error) throw error;
  if (!data?.session_name) throw new Error("WAHA provider sem session_name");
  if (data.status !== "connected") throw new Error(`WAHA provider não conectado (${data.status || "sem status"})`);
  return data;
}

async function sendWahaText(sessionName: string, chatId: string, text: string, id: string) {
  const baseUrl = (process.env.WAHA_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.WAHA_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) throw new Error("WAHA não configurado no servidor");

  const res = await fetch(`${baseUrl}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      session: sessionName,
      chatId,
      text,
      id,
      linkPreview: false,
    }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `WAHA sendText falhou (${res.status})`;
    throw new Error(message);
  }

  return extractWahaMessageId(body) ?? id;
}

async function processWhatsappNotifications(admin: NonNullable<ReturnType<typeof getAdminClient>>) {
  const { data: rows, error } = await admin
    .from("outbox_notificacoes")
    .select("id,escola_id,aluno_id,canal,destino,mensagem,status,request_id")
    .eq("canal", "whatsapp")
    .eq("status", "pending")
    .not("destino", "is", null)
    .not("mensagem", "is", null)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) throw error;

  const providerCache = new Map<string, Awaited<ReturnType<typeof getConnectedWahaProvider>>>();
  const results: Array<{ id: string; status: "sent" | "error" | "skipped"; error?: string }> = [];

  for (const row of (rows || []) as NotificationOutboxRow[]) {
    const chatId = normalizeWhatsappChatId(row.destino);
    const text = String(row.mensagem ?? "").trim();
    const now = new Date().toISOString();

    if (!chatId || !text) {
      const message = !chatId ? "Telefone WhatsApp inválido ou ausente" : "Mensagem WhatsApp vazia";
      await admin
        .from("outbox_notificacoes")
        .update({ status: "error", error_message: message, processed_at: now })
        .eq("id", row.id);
      results.push({ id: row.id, status: "error", error: message });
      continue;
    }

    try {
      let provider = providerCache.get(row.escola_id);
      if (!provider) {
        try {
          provider = await getConnectedWahaProvider(admin, row.escola_id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ id: row.id, status: "skipped", error: message });
          continue;
        }
        providerCache.set(row.escola_id, provider);
      }

      const messageId = await sendWahaText(provider.session_name, chatId, text, row.id);
      await admin
        .from("outbox_notificacoes")
        .update({
          status: "sent",
          mensagem_id: messageId,
          error_message: null,
          processed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("outbox_notificacoes")
        .update({ status: "error", error_message: message, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      results.push({ id: row.id, status: "error", error: message });
    }
  }

  return results;
}

async function provisionStudent(admin: NonNullable<ReturnType<typeof getAdminClient>>, event: OutboxEvent) {
  const payload = (event.payload || {}) as Record<string, any>;
  const alunoId = payload.aluno_id as string | undefined;
  const canal = (payload.canal || "whatsapp") as string;
  const actorUserId = payload.actor_user_id as string | undefined;
  const idempotencyKey = event.idempotency_key || payload.idempotency_key;

  if (!alunoId) {
    throw new Error("payload missing aluno_id");
  }

  const { data: aluno, error: alunoErr } = await admin
    .from("alunos")
    .select(
      "id, nome, email, bi_numero, numero_processo, responsavel_contato, telefone_responsavel, encarregado_telefone, escola_id, profile_id, usuario_auth_id, codigo_ativacao"
    )
    .eq("id", alunoId)
    .maybeSingle();

  if (alunoErr) throw alunoErr;
  if (!aluno) throw new Error("aluno not found");

  const escolaId = aluno.escola_id as string;
  const { data: escola } = await admin
    .from("escolas")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaNome = escola?.nome ?? "Escola";
  let loginDisplay = "";
  const existingProfileId = aluno.profile_id || aluno.usuario_auth_id || null;
  if (existingProfileId) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("numero_processo_login")
      .eq("user_id", existingProfileId)
      .maybeSingle();
    loginDisplay = String(existingProfile?.numero_processo_login || "").trim();
  }
  if (!loginDisplay) {
    const numeroProcessoRaw = aluno.numero_processo ? String(aluno.numero_processo).trim() : "";
    const { data: loginLabel, error: loginError } = await (admin as any).rpc("build_numero_login", {
      p_escola_id: escolaId,
      p_numero_processo: numeroProcessoRaw,
    });
    if (loginError || !loginLabel) {
      throw new Error(loginError?.message || "failed to generate student login");
    }
    loginDisplay = String(loginLabel).trim();
  }
  const login = `${loginDisplay}@klasse.ao`.toLowerCase();
  const telefone = aluno.responsavel_contato || aluno.telefone_responsavel || aluno.encarregado_telefone || null;
  const token = createActivationToken({
    escola_id: escolaId,
    escola_nome: escolaNome,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  const escolaSlug = escolaNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.klasse.ao").replace(/\/$/, "");
  const activationQuery = new URLSearchParams();
  if (aluno.codigo_ativacao) activationQuery.set("codigo", aluno.codigo_ativacao);
  if (token) activationQuery.set("token", token);
  if (escolaSlug) activationQuery.set("escola", escolaSlug);
  const activationLink = `${baseUrl}/ativar-acesso?${activationQuery.toString()}`;

  let userId = aluno.usuario_auth_id || aluno.profile_id || null;
  if (!userId) {
    const senha = Math.random().toString(36).slice(-12) + "A1!";
    const createRes = await admin.auth.admin.createUser({
      email: login,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: aluno.nome,
        role: "aluno",
        escola_id: escolaId,
        aluno_id: aluno.id,
        primeiro_acesso: true,
        must_change_password: true,
      },
      app_metadata: { role: "aluno", escola_id: escolaId },
    });

    if (createRes.error) {
      if (createRes.error.message?.toLowerCase().includes("registered")) {
        const { data: listUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = listUsers?.users?.find((u) => u.email === login);
        userId = existing?.id ?? null;
      } else {
        throw createRes.error;
      }
    } else {
      userId = createRes.data.user?.id ?? null;
    }

    if (!userId) throw new Error("failed to provision user");
  }

  await admin.from("profiles").upsert(
    {
      user_id: userId,
      email: login,
      nome: aluno.nome,
      role: "aluno" as any,
      escola_id: escolaId,
      current_escola_id: escolaId,
      numero_processo_login: loginDisplay || null,
      email_auth: login,
    },
    { onConflict: "user_id" }
  );

  await admin
    .from("escola_users")
    .upsert({ escola_id: escolaId, user_id: userId, papel: "aluno" } as any, {
      onConflict: "escola_id,user_id",
    });

  await admin
    .from("alunos")
    .update({ profile_id: userId, usuario_auth_id: userId })
    .eq("id", aluno.id)
    .eq("escola_id", escolaId);

  const { data: outboxRows } = await admin
    .from("outbox_notificacoes")
    .select("id, request_id")
    .eq("aluno_id", aluno.id)
    .eq("escola_id", escolaId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const mensagem = `📚 KLASSE - ${escolaNome}\nAcesso liberado para ${aluno.nome}\nLogin: ${loginDisplay}\nCódigo: ${aluno.codigo_ativacao || ""}\nAtive em: ${activationLink}`;

  for (const row of outboxRows || []) {
    await admin
      .from("outbox_notificacoes")
      .update({
        canal,
        destino: telefone,
        mensagem,
        payload: { login: loginDisplay, codigo: aluno.codigo_ativacao, aluno_nome: aluno.nome, canal },
      })
      .eq("id", row.id);
  }

  await admin.from("audit_logs").insert({
    escola_id: escolaId,
    portal: "secretaria",
    acao: "AUTH_PROVISION_USER",
    tabela: "alunos",
    entity: "alunos",
    entity_id: aluno.id,
    actor_id: actorUserId ?? null,
    user_id: actorUserId ?? null,
    details: {
      aluno_id: aluno.id,
      canal,
      idempotency_key: idempotencyKey,
      job_id: event.id,
      attempt: event.attempts,
      provider: "supabase_auth",
    },
  });
}

async function emitirReciboPagamento(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  event: OutboxEvent
) {
  const payload = (event.payload || {}) as Record<string, unknown>;
  const pagamentoId = typeof payload.pagamento_id === "string" ? payload.pagamento_id : null;
  const mensalidadeId = typeof payload.mensalidade_id === "string" ? payload.mensalidade_id : null;

  if (!pagamentoId && !mensalidadeId) {
    throw new Error("payload missing pagamento_id or mensalidade_id");
  }

  // Se tiver mensalidade_id, usamos a RPC do sistema que é muito mais completa
  if (mensalidadeId) {
    const { data: res, error: rpcError } = await admin.rpc("emitir_recibo_system", {
      p_mensalidade_id: mensalidadeId,
    });

    if (rpcError) {
      // Ignoramos erros de status (mensalidade não paga) para evitar retries infinitos
      if (rpcError.message?.includes("não está paga")) {
        console.warn(`[RECIBO] Mensalidade ${mensalidadeId} ainda não está paga. Ignorando.`);
        return;
      }
      throw rpcError;
    }
    return;
  }

  // Fallback para pagamentos sem mensalidade direta (se existir no futuro)
  const { data: pagamento, error: pagamentoErr } = await admin
    .from("pagamentos")
    .select("id, escola_id, aluno_id, mensalidade_id, valor_pago, data_pagamento, metodo, reference")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (pagamentoErr) throw pagamentoErr;
  if (!pagamento) throw new Error("pagamento not found");

  const row = pagamento as PagamentoRow;
  if (!row.aluno_id) throw new Error("pagamento sem aluno_id");

  if (row.mensalidade_id) {
    const { data: existingMensalidadeDoc } = await admin
      .from("documentos_emitidos")
      .select("id")
      .eq("tipo", "recibo")
      .eq("mensalidade_id", row.mensalidade_id)
      .maybeSingle();

    if (existingMensalidadeDoc?.id) return;
  } else {
    const { data: existingByPagamento } = await admin
      .from("documentos_emitidos")
      .select("id")
      .eq("tipo", "recibo")
      .eq("escola_id", row.escola_id)
      .contains("dados_snapshot", { pagamento_id: row.id })
      .limit(1);

    if ((existingByPagamento ?? []).length > 0) return;
  }

  const valor = Number(row.valor_pago ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("pagamento com valor inválido");

  const hash = crypto.randomUUID().replace(/-/g, "");
  const { error: insertDocError } = await admin.from("documentos_emitidos").insert({
    escola_id: row.escola_id,
    aluno_id: row.aluno_id,
    mensalidade_id: row.mensalidade_id,
    tipo: "recibo",
    dados_snapshot: {
      origem: "pagamento_auto",
      pagamento_id: row.id,
      mensalidade_id: row.mensalidade_id,
      valor_pago: valor,
      data_pagamento: row.data_pagamento,
      metodo: row.metodo,
      reference: row.reference,
      hash_validacao: hash,
    },
    created_by: null,
    hash_validacao: hash,
  });

  if (insertDocError && insertDocError.code !== "23505") {
    throw insertDocError;
  }
}

async function runOutboxWorker(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.OUTBOX_JOB_TOKEN || process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const processTopic = async (
    topic: string,
    handler: (event: OutboxEvent) => Promise<void>
  ) => {
    const { data: events, error } = await admin.rpc("claim_outbox_events", {
      p_topic: topic,
      p_limit: 25,
    });

    if (error) {
      throw new Error(`[${topic}] ${error.message}`);
    }

    const items = (events || []) as OutboxEvent[];
    const results = [] as Array<{ id: string; status: string; error?: string }>;

    for (const event of items) {
      try {
        await handler(event);
        await markEvent(admin, event, "sent");
        results.push({ id: event.id, status: "sent" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await markEvent(admin, event, "failed", message);
        results.push({ id: event.id, status: "failed", error: message });
      }
    }

    return results;
  };

  const authResults = await processTopic("auth_provision_student", (event) =>
    provisionStudent(admin, event)
  );

  const reciboResults = await processTopic("financeiro_recibo_pagamento", (event) =>
    emitirReciboPagamento(admin, event)
  );

  const whatsappResults = await processWhatsappNotifications(admin);

  const results = [...authResults, ...reciboResults];
  return NextResponse.json({
    ok: true,
    processed: results.length + whatsappResults.length,
    results,
    whatsapp: whatsappResults,
  });
}

export async function GET(req: Request) {
  return runOutboxWorker(req);
}

export async function POST(req: Request) {
  return runOutboxWorker(req);
}
