import { NextResponse } from "next/server";
import { requireFormacaoRoles, assertCohortAccess } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { getCohortReferenceValue } from "@/lib/cohort-finance";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formador",
  "super_admin",
  "global_admin",
];

type ProfileRow = {
  user_id: string;
  nome: string;
  email: string | null;
};

type FormandoRow = {
  id: string;
  fatura_lote_id: string;
  formando_user_id: string;
  status_pagamento: string;
  valor_total: number | null;
  descricao: string;
  created_at: string;
};

type InscricaoRow = {
  id: string;
  formando_user_id: string;
  estado: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  nome_snapshot: string | null;
  email_snapshot: string | null;
  telefone_snapshot: string | null;
};

type SessaoRow = {
  id: string;
  formador_user_id: string;
  competencia: string;
  horas_ministradas: number;
  valor_hora: number;
  status: string;
};

type CertificadoRow = {
  id: string;
  numero_documento: string;
  emitido_em: string;
  formando_user_id: string;
  template_id: string | null;
};

async function getProfilesByIds(client: FormacaoSupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return [] as ProfileRow[];

  const { data, error } = await client.rpc("tenant_profiles_by_ids", {
    p_user_ids: userIds,
  });

  if (error || !Array.isArray(data)) return [] as ProfileRow[];

  return data
    .map((row) => {
      const parsed = row as { user_id?: string; nome?: string; email?: string | null };
      if (!parsed.user_id || !parsed.nome) return null;
      return {
        user_id: String(parsed.user_id),
        nome: String(parsed.nome),
        email: parsed.email ? String(parsed.email) : null,
      };
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

function aggregatePaymentStatus(statuses: string[]) {
  const normalized = statuses.map((status) => status.toLowerCase());
  if (normalized.some((status) => status.includes("atras"))) return "atrasado";
  if (normalized.every((status) => status.includes("pago"))) return "pago";
  return "pendente";
}

function parseItemStatus(status: string) {
  const value = String(status ?? "").toLowerCase();
  if (value.includes("pago")) return "pago";
  if (value.includes("atras")) return "atrasado";
  return "pendente";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  if (!cohortId) {
    return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data: cohort, error: cohortError } = await s
    .from("formacao_cohorts")
    .select("id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status, created_at, curso_id, turno, formacao_cursos(nome)")
    .eq("escola_id", auth.escolaId)
    .eq("id", cohortId)
    .single();

  if (cohortError || !cohort) {
    return NextResponse.json({ ok: false, error: cohortError?.message ?? "Cohort não encontrado" }, { status: 404 });
  }

  // Use real course name if join succeeded
  const actualCourseName = (cohort as any).formacao_cursos?.nome || cohort.curso_nome;
  const enrichedCohort = {
    ...cohort,
    curso_nome: actualCourseName,
    formacao_cursos: undefined
  };

  const valorReferencia = await getCohortReferenceValue(
    s,
    auth.escolaId as string,
    cohort.id
  );

  const { data: formadoresRows } = await s
    .from("formacao_cohort_formadores")
    .select("id, formador_user_id, percentual_honorario, created_at")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  const { data: faturasRows } = await s
    .from("formacao_faturas_lote")
    .select("id, cliente_b2b_id, referencia, vencimento_em, total_liquido, status, updated_at, created_at")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  const loteIds = (faturasRows ?? []).map((row) => String((row as { id: string }).id));
  const clienteIds = Array.from(
    new Set(
      (faturasRows ?? [])
        .map((row) => String((row as { cliente_b2b_id?: string | null }).cliente_b2b_id ?? "").trim())
        .filter(Boolean)
    )
  );

  let clientesMap = new Map<string, { id: string; nome_fantasia: string; razao_social: string | null }>();
  if (clienteIds.length > 0) {
    const { data: clientesRows } = await s
      .from("formacao_clientes_b2b")
      .select("id, nome_fantasia, razao_social")
      .eq("escola_id", auth.escolaId)
      .in("id", clienteIds);

    clientesMap = new Map(
      (clientesRows ?? []).map((row) => {
        const typed = row as { id: string; nome_fantasia: string; razao_social: string | null };
        return [typed.id, typed];
      })
    );
  }

  let formandoRows: FormandoRow[] = [];
  if (loteIds.length > 0) {
    const { data } = await s
      .from("formacao_faturas_lote_itens")
      .select("id, fatura_lote_id, formando_user_id, status_pagamento, valor_total, descricao, created_at")
      .eq("escola_id", auth.escolaId)
      .in("fatura_lote_id", loteIds)
      .order("created_at", { ascending: false });

    formandoRows = (data ?? []) as FormandoRow[];
  }

  const { data: sessoesData } = await s
    .from("formacao_honorarios_lancamentos")
    .select("id, formador_user_id, competencia, horas_ministradas, valor_hora, status")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("competencia", { ascending: false })
    .limit(200);

  const sessoesRows = (sessoesData ?? []) as SessaoRow[];

  const { data: certificadosData } = await s
    .from("formacao_certificados_emitidos")
    .select("id, numero_documento, emitido_em, formando_user_id, template_id")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("emitido_em", { ascending: false })
    .limit(300);

  const certificadosRows = (certificadosData ?? []) as CertificadoRow[];

  const { data: inscricoesData } = await s
    .from("formacao_inscricoes")
    .select("id, formando_user_id, estado, metadata, created_at, nome_snapshot, email_snapshot, telefone_snapshot")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  const inscricoesRows = (inscricoesData ?? []) as InscricaoRow[];

  const userIds = Array.from(
    new Set([
      ...formandoRows.map((row) => row.formando_user_id),
      ...inscricoesRows.map((row) => row.formando_user_id),
      ...sessoesRows.map((row) => row.formador_user_id),
      ...certificadosRows.map((row) => row.formando_user_id),
      ...(formadoresRows ?? []).map((row) => String((row as { formador_user_id: string }).formador_user_id)),
    ])
  );

  const profiles = await getProfilesByIds(s, userIds);
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));

  const groupedFormandos = new Map<
    string,
    {
      userId: string;
      statuses: string[];
      valor: number;
      lastDescricao: string;
      parcelas: Array<{ item_id: string; descricao: string; status: "pago" | "pendente" | "atrasado"; valor: number }>;
    }
  >();

  for (const row of formandoRows) {
    const current = groupedFormandos.get(row.formando_user_id);
    if (!current) {
      groupedFormandos.set(row.formando_user_id, {
        userId: row.formando_user_id,
        statuses: [row.status_pagamento],
        valor: Number(row.valor_total ?? 0),
        lastDescricao: row.descricao,
        parcelas: [
          {
            item_id: row.id,
            descricao: String(row.descricao ?? "").trim() || "Parcela",
            status: parseItemStatus(row.status_pagamento),
            valor: Number(row.valor_total ?? 0),
          },
        ],
      });
      continue;
    }

    current.statuses.push(row.status_pagamento);
    current.valor += Number(row.valor_total ?? 0);
    if (row.descricao) current.lastDescricao = row.descricao;
    current.parcelas.push({
      item_id: row.id,
      descricao: String(row.descricao ?? "").trim() || "Parcela",
      status: parseItemStatus(row.status_pagamento),
      valor: Number(row.valor_total ?? 0),
    });
  }

  const inscricaoByUser = new Map<
    string,
    {
      estado: string;
      accessBlocked: boolean;
      nomeSnapshot: string | null;
      emailSnapshot: string | null;
      telefoneSnapshot: string | null;
    }
  >();

  for (const row of inscricoesRows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const accessBlocked = Boolean(metadata.portal_access_blocked === true);
    if (!inscricaoByUser.has(row.formando_user_id)) {
      inscricaoByUser.set(row.formando_user_id, {
        estado: String(row.estado ?? "").trim().toLowerCase() || "pre_inscrito",
        accessBlocked,
        nomeSnapshot: row.nome_snapshot,
        emailSnapshot: row.email_snapshot,
        telefoneSnapshot: row.telefone_snapshot,
      });
    }
  }

  for (const row of inscricoesRows) {
    if (!groupedFormandos.has(row.formando_user_id)) {
      groupedFormandos.set(row.formando_user_id, {
        userId: row.formando_user_id,
        statuses: ["pendente"],
        valor: 0,
        lastDescricao: "Inscrição",
        parcelas: [],
      });
    }
  }

  const formandos = Array.from(groupedFormandos.values()).map((group) => {
    const profile = profileMap.get(group.userId);
    const inscricaoState = inscricaoByUser.get(group.userId);
    // Buscar o ID da inscrição para este usuário nesta cohort
    const inscricaoOriginal = inscricoesRows.find(i => i.formando_user_id === group.userId);

    return {
      user_id: group.userId,
      inscricao_id: inscricaoOriginal?.id ?? null,
      nome: profile?.nome ?? inscricaoState?.nomeSnapshot ?? "Formando",
      email: profile?.email ?? inscricaoState?.emailSnapshot ?? null,
      telefone: inscricaoState?.telefoneSnapshot ?? null,
      presenca_percentual: null,
      status_pagamento: aggregatePaymentStatus(group.statuses),
      valor_total: group.valor,
      descricao: group.lastDescricao,
      parcelas: group.parcelas,
      academic_status: inscricaoState?.estado || "pre_inscrito",
      access_blocked: Boolean(inscricaoState?.accessBlocked),
      recomendado_certificacao: Boolean((inscricaoOriginal as any)?.recomendado_certificacao),
    };
  });

  const parcelasMap = new Map<string, { label: string; values: number[] }>();
  for (const row of formandos) {
    for (const parcela of row.parcelas) {
      const key = parcela.descricao.toLowerCase();
      const current = parcelasMap.get(key);
      if (!current) {
        parcelasMap.set(key, { label: parcela.descricao, values: [parcela.valor] });
      } else {
        current.values.push(parcela.valor);
      }
    }
  }
  const parcelasLabels = Array.from(parcelasMap.values())
    .sort((a, b) => a.label.localeCompare(b.label, "pt"))
    .map((row) => row.label);

  const receivedB2C = formandoRows
    .filter((row) => parseItemStatus(row.status_pagamento) === "pago")
    .reduce((sum, row) => sum + Number(row.valor_total ?? 0), 0);
  const pendingB2C = formandoRows
    .filter((row) => parseItemStatus(row.status_pagamento) !== "pago")
    .reduce((sum, row) => sum + Number(row.valor_total ?? 0), 0);

  const nonConsumerFaturas = (faturasRows ?? []).filter((row) => {
    const typed = row as { cliente_b2b_id: string };
    const cliente = clientesMap.get(String(typed.cliente_b2b_id ?? ""));
    return cliente && cliente.nome_fantasia !== "Consumidor Final";
  });

  const isB2BMode = nonConsumerFaturas.length > 0;
  const b2bCurrent = (nonConsumerFaturas[0] ?? null) as
    | {
        id: string;
        cliente_b2b_id: string;
        referencia: string;
        vencimento_em: string;
        total_liquido: number | null;
        status: string;
        updated_at: string;
        created_at: string;
      }
    | null;
  const b2bCliente = b2bCurrent ? clientesMap.get(String(b2bCurrent.cliente_b2b_id)) ?? null : null;
  const b2bReceived = nonConsumerFaturas
    .filter((row) => String((row as { status: string }).status).toLowerCase().includes("paga"))
    .reduce((sum, row) => sum + Number((row as { total_liquido?: number | null }).total_liquido ?? 0), 0);
  const b2bPending = nonConsumerFaturas
    .filter((row) => !String((row as { status: string }).status).toLowerCase().includes("paga"))
    .reduce((sum, row) => sum + Number((row as { total_liquido?: number | null }).total_liquido ?? 0), 0);

  const b2bCoveredUserIds = b2bCurrent
    ? Array.from(
        new Set(
          formandoRows
            .filter((row) => row.fatura_lote_id === b2bCurrent.id)
            .map((row) => row.formando_user_id)
        )
      )
    : [];
  const b2bCovered = b2bCoveredUserIds.map((userId) => {
    const profile = profileMap.get(userId);
    return {
      user_id: userId,
      nome: profile?.nome ?? "Formando",
      email: profile?.email ?? null,
    };
  });

  const lastUpdated = (faturasRows ?? [])[0] as { updated_at?: string; created_at?: string } | undefined;

  const sessoes = sessoesRows.map((row) => ({
    ...row,
    formador_nome: profileMap.get(row.formador_user_id)?.nome ?? "Formador",
  }));

  const certificados = certificadosRows.map((row) => ({
    ...row,
    formando_nome: profileMap.get(row.formando_user_id)?.nome ?? "Formando",
  }));

  const { data: materiaisData } = await s
    .from("formacao_cohort_materiais")
    .select("id, titulo, tipo, updated_at")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: true });

  const materiais = (materiaisData ?? []).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    tipo: m.tipo,
    status: "disponivel",
    updated_at: m.updated_at,
  }));

  if (materiais.length === 0) {
    // Add default placeholders if no materials are found (fallback)
    materiais.push(
      {
        id: `${cohortId}:plano`,
        titulo: `Plano curricular · ${cohort.nome}`,
        tipo: "plano",
        status: "disponivel",
        updated_at: cohort.created_at,
      },
      {
        id: `${cohortId}:agenda`,
        titulo: `Agenda de execução · ${cohort.data_inicio} → ${cohort.data_fim}`,
        tipo: "agenda",
        status: "disponivel",
        updated_at: cohort.created_at,
      }
    );
  }

  const formadores = (formadoresRows ?? []).map((row) => {
    const typed = row as {
      id: string;
      formador_user_id: string;
      percentual_honorario: number;
      created_at: string;
    };
    return {
      id: typed.id,
      user_id: typed.formador_user_id,
      percentual_honorario: typed.percentual_honorario,
      created_at: typed.created_at,
      nome: profileMap.get(typed.formador_user_id)?.nome ?? "Formador",
      email: profileMap.get(typed.formador_user_id)?.email ?? null,
    };
  });

  const { data: modulosData } = await s
    .from("formacao_cohort_modulos")
    .select("id, titulo, ordem, carga_horaria")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("ordem", { ascending: true });

  const modulos = (modulosData ?? []).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    ordem: m.ordem,
    carga_horaria: m.carga_horaria,
  }));

  const isFormador = auth.role === "formador";

  return NextResponse.json({
    ok: true,
    cohort: {
      ...enrichedCohort,
      valor_referencia: isFormador ? null : valorReferencia,
    },
    tabs: {
      formandos,
      sessoes,
      materiais,
      certificados,
      formadores,
      modulos,
    },
    summary: {
      formandos: formandos.length,
      sessoes: sessoes.length,
      materiais: materiais.length,
      certificados: certificados.length,
      modulos: modulos.length,
    },
    finance: isFormador ? null : {
      mode: isB2BMode ? "b2b" : "b2c",
      recebido: isB2BMode ? b2bReceived : receivedB2C,
      pendente: isB2BMode ? b2bPending : pendingB2C,
      atualizado_em: lastUpdated?.updated_at ?? lastUpdated?.created_at ?? cohort.created_at,
      b2c: {
        parcelas: parcelasLabels,
      },
      b2b: b2bCurrent
        ? {
            cliente: {
              id: b2bCliente?.id ?? "",
              nome_fantasia: b2bCliente?.nome_fantasia ?? "Cliente B2B",
              razao_social: b2bCliente?.razao_social ?? null,
            },
            fatura: {
              id: b2bCurrent.id,
              referencia: b2bCurrent.referencia,
              vencimento_em: b2bCurrent.vencimento_em,
              total_liquido: Number(b2bCurrent.total_liquido ?? 0),
              status: b2bCurrent.status,
            },
            colaboradores_cobertos: b2bCovered,
          }
        : null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const body = (await request.json().catch(() => null)) as {
    relatorio_pedagogico?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "Corpo inválido" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const updateData: any = {};
  if (typeof body.relatorio_pedagogico === "string") {
    updateData.relatorio_pedagogico = body.relatorio_pedagogico;
  }

  const { error } = await s
    .from("formacao_cohorts")
    .update(updateData)
    .eq("escola_id", auth.escolaId)
    .eq("id", cohortId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

