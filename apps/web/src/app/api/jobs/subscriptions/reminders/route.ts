import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildLifecycleReminderEmail, resolveEmailLoginUrl, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const TRIAL_MILESTONES = new Set([7, 3, 1]);
const ONBOARDING_MILESTONES = new Set([1, 3, 7, 14]);
const INACTIVITY_MILESTONES = new Set([5, 10, 15, 30]);

function resolveJobToken(req: Request) {
  return req.headers.get("x-job-token") || req.headers.get("authorization")?.replace("Bearer ", "");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Settings = {
  banco?: string | null;
  titular_conta?: string | null;
  iban?: string | null;
  numero_conta?: string | null;
  kwik_chave?: string | null;
  email_comercial?: string | null;
  telefone_comercial?: string | null;
  whatsapp_comercial?: string | null;
  link_pagamento?: string | null;
  lembrete_trial_template?: string | null;
  lembrete_expirado_template?: string | null;
  lembrete_onboarding_template?: string | null;
  lembrete_inatividade_template?: string | null;
  auto_reminders_enabled?: boolean;
};

type ReminderKind = "trial" | "onboarding" | "inactivity";

type ReminderResult = {
  escola_id: string;
  kind: ReminderKind;
  status: "sent" | "failed" | "error" | "skipped";
  reason?: string;
  error?: string;
};

type CentroRow = {
  escola_id: string;
  nome: string | null;
  email: string | null;
  status: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  last_automated_reminder_at: string | null;
  escolas?: {
    assinaturas?: Array<{
      status?: string | null;
      pagamentos_saas?: Array<{ status?: string | null; created_at?: string | null }>;
    }>;
  } | null;
};

type OnboardingSignals = {
  cursos: Set<string>;
  cohorts: Set<string>;
  cohortsAbertas: Set<string>;
  valores: Set<string>;
  formadores: Set<string>;
  fiscal: Set<string>;
  cobrancas: Set<string>;
};

type OnboardingStep = {
  key: string;
  title: string;
  hint: string;
  required: boolean;
  done: boolean;
};

function paymentSummary(settings: Settings) {
  return [
    settings.banco ? `Banco: ${settings.banco}` : "",
    settings.titular_conta ? `Titular: ${settings.titular_conta}` : "",
    settings.iban ? `IBAN: ${settings.iban}` : "",
    settings.numero_conta ? `Conta: ${settings.numero_conta}` : "",
    settings.kwik_chave ? `Kwik: ${settings.kwik_chave}` : "",
    settings.link_pagamento ? `Link: ${settings.link_pagamento}` : "",
  ].filter(Boolean).join(" | ");
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), template);
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function resolveLoginUrl() {
  return resolveEmailLoginUrl();
}

async function hasAuditForToday(admin: ReturnType<typeof getAdminClient>, escolaId: string, action: string, todayIso: string) {
  if (!admin) return false;
  const { data, error } = await admin
    .from("audit_logs")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("action", action)
    .gte("created_at", `${todayIso}T00:00:00.000Z`)
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

async function recordLifecycleAudit(
  admin: ReturnType<typeof getAdminClient>,
  params: {
    escolaId: string;
    action: string;
    to: string;
    kind: ReminderKind;
    details: Record<string, unknown>;
  }
) {
  if (!admin) return;
  await admin.from("audit_logs").insert({
    escola_id: params.escolaId,
    portal: "super_admin",
    action: params.action,
    acao: params.action,
    entity: "centros_formacao",
    tabela: "centros_formacao",
    entity_id: params.escolaId,
    registro_id: params.escolaId,
    details: {
      channel: "email",
      to: params.to,
      kind: params.kind,
      ...params.details,
    },
  });
}

async function markReminderSent(admin: ReturnType<typeof getAdminClient>, escolaId: string) {
  if (!admin) return;
  await admin
    .from("centros_formacao")
    .update({
      last_automated_reminder_at: new Date().toISOString(),
      last_commercial_contact_at: new Date().toISOString(),
    })
    .eq("escola_id", escolaId);
}

async function loadLastSignInByUser(admin: NonNullable<ReturnType<typeof getAdminClient>>) {
  const result = new Map<string, string | null>();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    for (const user of users) {
      result.set(user.id, user.last_sign_in_at ?? null);
    }
    if (users.length < 1000) break;
  }
  return result;
}

async function loadCentroTeamLastAccess(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  centroIds: string[],
  lastSignInByUser: Map<string, string | null>
) {
  const result = new Map<string, string | null>();
  if (centroIds.length === 0) return result;

  const { data } = await admin
    .from("escola_users")
    .select("escola_id,user_id,papel")
    .in("escola_id", centroIds)
    .in("papel", ["formacao_admin", "formacao_secretaria", "formacao_financeiro"]);

  for (const link of data ?? []) {
    const escolaId = String(link.escola_id ?? "");
    const userId = String(link.user_id ?? "");
    if (!escolaId || !userId) continue;
    const last = lastSignInByUser.get(userId) ?? null;
    const current = result.get(escolaId) ?? null;
    if (!current || (last && new Date(last).getTime() > new Date(current).getTime())) {
      result.set(escolaId, last);
    }
  }

  return result;
}

function idsFromRows(rows: Array<{ escola_id?: string | null }> | null | undefined) {
  return new Set((rows ?? []).map((row) => String(row.escola_id ?? "")).filter(Boolean));
}

async function loadOnboardingSignals(admin: NonNullable<ReturnType<typeof getAdminClient>>, centroIds: string[]) {
  const empty: OnboardingSignals = {
    cursos: new Set(),
    cohorts: new Set(),
    cohortsAbertas: new Set(),
    valores: new Set(),
    formadores: new Set(),
    fiscal: new Set(),
    cobrancas: new Set(),
  };

  if (centroIds.length === 0) return empty;

  const [cursosRes, cohortsRes, cohortsAbertasRes, valoresRes, formadoresRes, fiscalRes, cobrancasRes] = await Promise.all([
    admin.from("formacao_cursos").select("escola_id").in("escola_id", centroIds).limit(5000),
    admin.from("formacao_cohorts").select("escola_id").in("escola_id", centroIds).limit(5000),
    admin.from("formacao_cohorts").select("escola_id").in("escola_id", centroIds).eq("status", "aberta").limit(5000),
    admin
      .from("formacao_cohort_financeiro")
      .select("escola_id")
      .in("escola_id", centroIds)
      .gt("valor_referencia", 0)
      .limit(5000),
    admin.from("formacao_cohort_formadores").select("escola_id").in("escola_id", centroIds).limit(5000),
    admin.from("fiscal_escola_bindings").select("escola_id").in("escola_id", centroIds).limit(5000),
    admin.from("formacao_faturas_lote_itens").select("escola_id").in("escola_id", centroIds).limit(5000),
  ]);

  return {
    cursos: cursosRes.error ? empty.cursos : idsFromRows(cursosRes.data),
    cohorts: cohortsRes.error ? empty.cohorts : idsFromRows(cohortsRes.data),
    cohortsAbertas: cohortsAbertasRes.error ? empty.cohortsAbertas : idsFromRows(cohortsAbertasRes.data),
    valores: valoresRes.error ? empty.valores : idsFromRows(valoresRes.data),
    formadores: formadoresRes.error ? empty.formadores : idsFromRows(formadoresRes.data),
    fiscal: fiscalRes.error ? empty.fiscal : idsFromRows(fiscalRes.data),
    cobrancas: cobrancasRes.error ? empty.cobrancas : idsFromRows(cobrancasRes.data),
  };
}

function buildOnboardingChecklist(escolaId: string, signals: OnboardingSignals): OnboardingStep[] {
  return [
    {
      key: "curso",
      title: "Curso criado",
      hint: "Pelo menos 1 curso ativo no catálogo.",
      required: true,
      done: signals.cursos.has(escolaId),
    },
    {
      key: "cohort",
      title: "Turma criada (datas e vagas)",
      hint: "Pelo menos 1 edição operacional com calendário.",
      required: true,
      done: signals.cohorts.has(escolaId),
    },
    {
      key: "status_aberta",
      title: "Turma em estado Aberto",
      hint: "Mudar o status de pelo menos uma turma para 'aberta' para permitir inscrições.",
      required: true,
      done: signals.cohortsAbertas.has(escolaId),
    },
    {
      key: "valor",
      title: "Valor do curso definido para a turma",
      hint: "Definir valor de referência (> 0) para cobrança.",
      required: true,
      done: signals.valores.has(escolaId),
    },
    {
      key: "formador",
      title: "Formador atribuído à turma",
      hint: "Pelo menos 1 formador vinculado à edição.",
      required: true,
      done: signals.formadores.has(escolaId),
    },
    {
      key: "fiscal",
      title: "Configuração Fiscal",
      hint: "Vincular o centro a uma empresa fiscal e definir séries de faturamento.",
      required: true,
      done: signals.fiscal.has(escolaId),
    },
    {
      key: "cobranca",
      title: "Primeira cobrança preparada",
      hint: "Recomendado criar a primeira cobrança para validar operação financeira.",
      required: false,
      done: signals.cobrancas.has(escolaId),
    },
  ];
}

function formatMissingOnboardingSteps(steps: OnboardingStep[]) {
  if (steps.length === 0) return "Sem pendências obrigatórias identificadas.";
  return steps.map((step, index) => `${index + 1}. ${step.title} - ${step.hint}`).join("\n");
}

function hasActiveOrPendingBilling(centro: CentroRow) {
  const assinaturas = (centro.escolas?.assinaturas ?? []) as Array<{
    status?: string | null;
    pagamentos_saas?: Array<{ status?: string | null }>;
  }>;
  const hasActiveSub = assinaturas.some((assinatura) => assinatura.status === "activa");
  const hasPendingPayment = assinaturas.some((assinatura) =>
    (assinatura.pagamentos_saas ?? []).some((pagamento) => pagamento.status === "pendente")
  );
  return { hasActiveSub, hasPendingPayment };
}

async function sendLifecycleEmail(params: {
  admin: NonNullable<ReturnType<typeof getAdminClient>>;
  centro: CentroRow;
  settings: Settings;
  kind: ReminderKind;
  action: string;
  subject: string;
  message: string;
  todayIso: string;
  details: Record<string, unknown>;
}) {
  const to = String(params.centro.email ?? "").trim().toLowerCase();
  const escolaId = String(params.centro.escola_id);
  if (!to) {
    return { escola_id: escolaId, kind: params.kind, status: "skipped" as const, reason: "missing_email" };
  }

  if (await hasAuditForToday(params.admin, escolaId, params.action, params.todayIso)) {
    return { escola_id: escolaId, kind: params.kind, status: "skipped" as const, reason: "already_sent_today" };
  }

  const mail = await buildLifecycleReminderEmail({
    subject: params.subject,
    title: params.subject.replace(/^KLASSE Formação ·\s*/, ""),
    previewText: params.message,
    centroNome: String(params.centro.nome ?? "Centro"),
    message: params.message,
    actionUrl: resolveLoginUrl(),
    actionLabel: "Entrar no KLASSE",
    contactEmail: params.settings.email_comercial ?? null,
    contactWhatsapp: params.settings.whatsapp_comercial ?? null,
  });
  const sent = await sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text });

  if (!sent.ok) {
    return { escola_id: escolaId, kind: params.kind, status: "failed" as const, error: sent.error };
  }

  await markReminderSent(params.admin, escolaId);
  await recordLifecycleAudit(params.admin, {
    escolaId,
    action: params.action,
    to,
    kind: params.kind,
    details: params.details,
  });

  return { escola_id: escolaId, kind: params.kind, status: "sent" as const };
}

async function runReminderJob(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const { data: settingsRaw, error: settingsError } = await admin
    .from("super_admin_commercial_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (settingsError) throw settingsError;
  const settings = (settingsRaw ?? {}) as Settings;

  if (!settings.auto_reminders_enabled) {
    return NextResponse.json({ ok: true, message: "Automação desativada nas configurações" });
  }

  const { data: centrosRaw, error: centrosError } = await admin
    .from("centros_formacao")
    .select(`
      escola_id, nome, email, status, subscription_status, trial_ends_at, created_at, last_automated_reminder_at,
      escolas:escola_id (
        assinaturas (
          status,
          pagamentos_saas (status, created_at)
        )
      )
    `)
    .not("email", "is", null)
    .limit(1000);

  if (centrosError) throw centrosError;

  const centros = (centrosRaw ?? []) as unknown as CentroRow[];
  const centroIds = centros.map((centro) => String(centro.escola_id));
  const onboardingCentroIds = centros
    .filter((centro) => String(centro.status ?? "") === "onboarding")
    .map((centro) => String(centro.escola_id));
  const lastSignInByUser = await loadLastSignInByUser(admin);
  const [lastAccessByCentro, onboardingSignals] = await Promise.all([
    loadCentroTeamLastAccess(admin, centroIds, lastSignInByUser),
    loadOnboardingSignals(admin, onboardingCentroIds),
  ]);
  const results: ReminderResult[] = [];
  const todayIso = new Date().toISOString().split("T")[0];
  const loginUrl = resolveLoginUrl();
  const payment = paymentSummary(settings) || "dados de pagamento ainda não configurados";

  for (const centro of centros) {
    const escolaId = String(centro.escola_id);
    try {
      const centroNome = String(centro.nome ?? "Centro");
      const { hasActiveSub, hasPendingPayment } = hasActiveOrPendingBilling(centro);
      const trialEndsAt = centro.trial_ends_at ? new Date(centro.trial_ends_at) : null;
      const diffMs = trialEndsAt ? trialEndsAt.getTime() - Date.now() : -1;
      const daysLeft = trialEndsAt ? Math.ceil(diffMs / 86_400_000) : null;
      const isExpired = centro.subscription_status === "expired" || Boolean(trialEndsAt && diffMs < 0);

      if (!hasActiveSub && !hasPendingPayment && (centro.subscription_status === "trial" || isExpired)) {
        const lastReminderDate = centro.last_automated_reminder_at
          ? new Date(centro.last_automated_reminder_at).toISOString().split("T")[0]
          : null;
        const shouldSendTrial =
          lastReminderDate !== todayIso &&
          ((daysLeft !== null && !isExpired && TRIAL_MILESTONES.has(daysLeft)) || (isExpired && !lastReminderDate));

        if (shouldSendTrial) {
          const template = isExpired
            ? settings.lembrete_expirado_template ||
              "Olá {{centro_nome}}, o período de teste terminou. Dados de pagamento: {{dados_pagamento}}"
            : settings.lembrete_trial_template ||
              "Olá {{centro_nome}}, o trial termina em {{dias_restantes}} dia(s). Dados de pagamento: {{dados_pagamento}}";
          const message = renderTemplate(template, {
            centro_nome: centroNome,
            dias_restantes: String(Math.max(0, daysLeft ?? 0)),
            dados_pagamento: payment,
            email_comercial: settings.email_comercial || "",
            telefone_comercial: settings.telefone_comercial || "",
            whatsapp_comercial: settings.whatsapp_comercial || "",
            link_pagamento: settings.link_pagamento || "",
            login_url: loginUrl,
          });

          results.push(
            await sendLifecycleEmail({
              admin,
              centro,
              settings,
              kind: "trial",
              action: isExpired ? "FORMACAO_AUTO_TRIAL_EXPIRED_REMINDER_SENT" : "FORMACAO_AUTO_TRIAL_REMINDER_SENT",
              subject: isExpired
                ? `KLASSE Formação · Trial expirado · ${centroNome}`
                : `KLASSE Formação · Trial termina em ${daysLeft} dia(s) · ${centroNome}`,
              message,
              todayIso,
              details: { days_left: daysLeft, is_expired: isExpired },
            })
          );
        }
      }

      const onboardingDays = daysSince(centro.created_at);
      if (String(centro.status ?? "") === "onboarding" && onboardingDays !== null && ONBOARDING_MILESTONES.has(onboardingDays)) {
        const checklist = buildOnboardingChecklist(escolaId, onboardingSignals);
        const requiredSteps = checklist.filter((step) => step.required);
        const missingRequiredSteps = requiredSteps.filter((step) => !step.done);
        const requiredDone = requiredSteps.length - missingRequiredSteps.length;
        if (missingRequiredSteps.length === 0) {
          results.push({ escola_id: escolaId, kind: "onboarding", status: "skipped", reason: "onboarding_required_steps_done" });
          continue;
        }

        const template =
          settings.lembrete_onboarding_template ||
          "Olá {{centro_nome}}, o onboarding do seu centro ainda não foi concluído há {{dias_sem_onboarding}} dia(s). Progresso: {{progresso_onboarding}}. Etapas pendentes:\n{{etapas_pendentes}}\nAceda: {{login_url}}";
        const message = renderTemplate(template, {
          centro_nome: centroNome,
          dias_sem_onboarding: String(onboardingDays),
          progresso_onboarding: `${requiredDone}/${requiredSteps.length}`,
          etapas_pendentes: formatMissingOnboardingSteps(missingRequiredSteps),
          dados_pagamento: payment,
          email_comercial: settings.email_comercial || "",
          telefone_comercial: settings.telefone_comercial || "",
          whatsapp_comercial: settings.whatsapp_comercial || "",
          link_pagamento: settings.link_pagamento || "",
          login_url: loginUrl,
        });

        results.push(
          await sendLifecycleEmail({
            admin,
            centro,
            settings,
            kind: "onboarding",
            action: "FORMACAO_AUTO_ONBOARDING_REMINDER_SENT",
            subject: `KLASSE Formação · Onboarding pendente · ${centroNome}`,
            message,
            todayIso,
            details: {
              days_without_onboarding: onboardingDays,
              required_done: requiredDone,
              required_total: requiredSteps.length,
              missing_steps: missingRequiredSteps.map((step) => step.key),
            },
          })
        );
      }

      const lastAccess = lastAccessByCentro.get(escolaId) ?? null;
      const inactivityBase = lastAccess ?? centro.created_at;
      const inactiveDays = daysSince(inactivityBase);
      const canSendInactivity =
        String(centro.status ?? "") !== "onboarding" &&
        !isExpired &&
        inactiveDays !== null &&
        INACTIVITY_MILESTONES.has(inactiveDays);

      if (canSendInactivity) {
        const template =
          settings.lembrete_inatividade_template ||
          "Olá {{centro_nome}}, o centro está há {{dias_sem_acesso}} dia(s) sem acesso operacional. Aceda: {{login_url}}";
        const message = renderTemplate(template, {
          centro_nome: centroNome,
          dias_sem_acesso: String(inactiveDays),
          dados_pagamento: payment,
          email_comercial: settings.email_comercial || "",
          telefone_comercial: settings.telefone_comercial || "",
          whatsapp_comercial: settings.whatsapp_comercial || "",
          link_pagamento: settings.link_pagamento || "",
          login_url: loginUrl,
        });

        results.push(
          await sendLifecycleEmail({
            admin,
            centro,
            settings,
            kind: "inactivity",
            action: "FORMACAO_AUTO_INACTIVITY_REMINDER_SENT",
            subject: `KLASSE Formação · Centro sem acesso há ${inactiveDays} dia(s) · ${centroNome}`,
            message,
            todayIso,
            details: { days_without_access: inactiveDays, last_access: lastAccess },
          })
        );
      }
    } catch (err) {
      results.push({
        escola_id: escolaId,
        kind: "trial",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(req: Request) {
  return runReminderJob(req);
}

export async function POST(req: Request) {
  return runReminderJob(req);
}
