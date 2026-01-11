import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type OutboxEvent = {
  id: string;
  escola_id: string;
  topic: string;
  request_id: string;
  idempotency_key?: string | null;
  payload: Record<string, any> | null;
  status: string;
  attempts: number;
  max_attempts?: number | null;
  next_run_at: string;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
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
  status: "processed" | "failed",
  lastError?: string | null
) {
  if (!admin) return;
  const attempts = event.attempts ?? 0;
  const maxAttempts = event.max_attempts ?? 5;
  const shouldDead = status === "failed" && attempts >= maxAttempts;
  const backoffMinutes = Math.min(60, Math.pow(2, Math.max(0, attempts))) * 5;
  await admin
    .from("outbox_events")
    .update({
      status: shouldDead ? "dead" : status,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      last_error: lastError ?? null,
      next_run_at:
        status === "failed" && !shouldDead
          ? new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
          : null,
    })
    .eq("id", event.id);
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
      "id, nome, email, bi_numero, responsavel_contato, telefone_responsavel, encarregado_telefone, escola_id, profile_id, usuario_auth_id, codigo_ativacao"
    )
    .eq("id", alunoId)
    .maybeSingle();

  if (alunoErr) throw alunoErr;
  if (!aluno) throw new Error("aluno not found");

  const escolaId = aluno.escola_id as string;
  const login = `aluno_${aluno.id}@${escolaId}.klasse.ao`.toLowerCase();
  const telefone = aluno.responsavel_contato || aluno.telefone_responsavel || aluno.encarregado_telefone || null;

  let userId = aluno.usuario_auth_id || aluno.profile_id || null;
  if (!userId) {
    const senha = Math.random().toString(36).slice(-12) + "A1!";
    const createRes = await admin.auth.admin.createUser({
      email: login,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: aluno.nome, role: "aluno", escola_id: escolaId, aluno_id: aluno.id, primeiro_acesso: true },
      app_metadata: { role: "aluno", escola_id: escolaId },
    });

    if (createRes.error) {
      if (createRes.error.message?.toLowerCase().includes("registered")) {
        const existing = await admin.auth.admin.getUserByEmail(login);
        userId = existing?.data?.user?.id ?? null;
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
      numero_login: login,
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

  const mensagem = `📚 KLASSE - Acesso liberado para ${aluno.nome}\nLogin: ${login}\nCódigo: ${aluno.codigo_ativacao || ""}\nPortal: https://portal.klasse.ao`;

  for (const row of outboxRows || []) {
    await admin
      .from("outbox_notificacoes")
      .update({
        canal,
        destino: telefone,
        mensagem,
        payload: { login, codigo: aluno.codigo_ativacao, aluno_nome: aluno.nome, canal },
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

export async function POST(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.OUTBOX_JOB_TOKEN || process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const { data: events, error } = await admin.rpc("claim_outbox_events", {
    p_topic: "auth_provision_student",
    p_limit: 25,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = (events || []) as OutboxEvent[];
  const results = [] as Array<{ id: string; status: string; error?: string }>;

  for (const event of items) {
    try {
      await provisionStudent(admin, event);
      await markEvent(admin, event, "processed");
      results.push({ id: event.id, status: "processed" });
    } catch (err: any) {
      const message = err?.message || String(err);
      await markEvent(admin, event, "failed", message);
      results.push({ id: event.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
