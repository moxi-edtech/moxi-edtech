import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { authorizeBalcaoPendingAcademicWrite, BALCAO_HISTORIC_OPERATOR_ROLES } from "@/lib/academico/authorize-balcao-academic-write";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { compareNextYearEnrollment, confirmedOutcomeFitsDestination } from "@/lib/rematricula/compare-next-year-enrollment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ReadRoles = [...BALCAO_HISTORIC_OPERATOR_ROLES, "secretaria_financeiro"] as const;
const WriteRoles = BALCAO_HISTORIC_OPERATOR_ROLES;
const ExactHistoricalDecisionRoles = new Set<string>(BALCAO_HISTORIC_OPERATOR_ROLES);

async function canWriteHistoricalDecision(supabase: any, escolaId: string): Promise<boolean> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;
  // Do not rely on user_has_role_in_school's role expansion here.
  // Use the exact tenant-scoped escola_users membership for these actions.
  const { data, error } = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
  return !error && ExactHistoricalDecisionRoles.has(String(data?.papel ?? ""));
}
const AcademicResult = z.enum(["aprovado", "reprovado", "concluido"]);
const Evidence = {
  matricula_id: z.string().uuid(),
  referencia_documental: z.string().trim().min(8).max(180),
  motivo: z.string().trim().min(12).max(500),
};

const ActionSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("concluir_ano_percurso"), matricula_id: z.string().uuid(), modo: z.enum(["resultado", "notas"]), resultado_confirmado: z.enum(["aprovado", "reprovado"]).optional() }),
  z.object({
    acao: z.literal("solicitar_intervencao"),
    matricula_id: z.string().uuid(),
    motivo: z.string().trim().min(12).max(500),
  }),
  z.object({
    acao: z.literal("registar_decisao"),
    ...Evidence,
    resultado_confirmado: AcademicResult,
  }),
  z.object({
    acao: z.literal("ratificar"),
    ...Evidence,
    resultado_confirmado: AcademicResult,
  }),
  z.object({
    acao: z.literal("fechar_historico"),
    matricula_id: z.string().uuid(),
    motivo: z.string().trim().min(12).max(500),
    confirmacao: z.literal("CONFIRMO_FECHO_LEGAL"),
  }),
]);

const Params = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  tipo: z.enum(["pendentes", "historicos"]).default("pendentes"),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
});

/** A documentary "concluído" means end of an academic cycle, not passage
 * from any ordinary class. Never infer this from an existing destination.
 * Final formal classes: 6ª, 9ª, 12ª; EJA final module/year as resolved by RAA.
 * Unknown regimes fail closed for cycle completion only.
 */
function allowsCycleCompletion(regime: any): boolean {
  // The EJA module/year model is not equivalent to ordinary class numbers.
  if (String(regime?.nivel_ensino ?? "").toLowerCase() === "eja") {
    return Number(regime?.modulo_numero) === 3 || Number(regime?.ano_numero) === 2;
  }
  const classe = Number(regime?.classe_num);
  if (Number.isInteger(classe) && classe >= 1 && classe <= 13) {
    return [6, 9, 12].includes(classe);
  }
  return false;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function schoolSession() {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, escolaId: null, error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { supabase, escolaId: null, error: NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 }) };
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ReadRoles] });
  if (authz.error) return { supabase, escolaId: null, error: authz.error };
  return { supabase, escolaId, error: null };
}

export async function GET(request: Request) {
  try {
    const { supabase, escolaId, error } = await schoolSession();
    if (error || !escolaId) return error!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const permiteEscrita = await canWriteHistoricalDecision(supabase, escolaId);
    const permiteNotasHistoricas = await authorizeBalcaoPendingAcademicWrite(supabase, escolaId, user.id);
    const { searchParams } = new URL(request.url);
    const requestedEnrollment = searchParams.get("matricula_id");
    if (requestedEnrollment !== null) {
      const parsedId = z.string().uuid().safeParse(requestedEnrollment);
      if (!parsedId.success) return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
      const { data: origin, error: originError } = await supabase.from("matriculas")
        .select("id,aluno_id,ano_letivo,session_id,status,ativo,status_fecho_origem,turma_id")
        .eq("escola_id", escolaId).eq("id", parsedId.data).maybeSingle();
      if (originError) throw originError;
      if (!origin) return NextResponse.json({ ok: false, error: "Matrícula não encontrada nesta escola." }, { status: 404 });
      const { data: sourceRegime, error: sourceRegimeError } = origin.turma_id
        ? await supabase.rpc("resolve_regime_academico", { p_turma_id: origin.turma_id })
        : { data: null, error: null };
      if (sourceRegimeError) throw sourceRegimeError;
      const [{ data: academicYear, error: yearError },
        { data: currentYear, error: currentYearError },
        { data: cohorts, error: cohortError },
        { data: history, error: historyError },
        { data: existingNotes, error: notesError }] = await Promise.all([
        supabase.from("anos_letivos").select("id,ativo,ano").eq("escola_id", escolaId)
          .eq("id", origin.session_id).maybeSingle(),
        supabase.from("anos_letivos").select("id,ano").eq("escola_id", escolaId)
          .eq("ativo", true).maybeSingle(),
        supabase.from("academic_transition_cohort_members")
          .select("status,cohort:academic_transition_cohorts!inner(codigo,modo,ativo,ano_origem,ano_destino,expira_em)")
          .eq("escola_id", escolaId).eq("matricula_origem_id", origin.id)
          .eq("aluno_id", origin.aluno_id).limit(20),
        supabase.from("historico_anos")
          .select("id,resultado_final,snapshot_status,ano_letivo_id,matricula_id")
          .eq("escola_id", escolaId).eq("aluno_id", origin.aluno_id)
          .eq("ano_letivo", origin.ano_letivo).maybeSingle(),
        supabase.from("notas").select("id").eq("escola_id", escolaId)
          .eq("matricula_id", origin.id).limit(1),
      ]);
      if (yearError || currentYearError || cohortError || historyError || notesError)
        throw yearError ?? currentYearError ?? cohortError ?? historyError ?? notesError;
      const isClosedSourceYear = academicYear?.ativo === false &&
        academicYear?.id === origin.session_id &&
        Number(academicYear?.ano) === Number(origin.ano_letivo);
      const cohort = (cohorts ?? []).map((row: any) =>
        ({ status: row.status, record: first(row.cohort) })).find(({ status, record }: any) =>
          status === "elegivel" && record?.ativo === true &&
          record?.modo === "virada_assistida_sem_notas" &&
          Number(record?.ano_origem) === Number(origin.ano_letivo) &&
          Number(record?.ano_destino) === Number(origin.ano_letivo) + 1 &&
          (!record?.expira_em || new Date(record.expira_em + "T23:59:59+01:00").getTime() >= Date.now()));
      const [{ data: ratifications, error: ratificationError }, { data: lock, error: lockError }] = await Promise.all([
        history ? supabase.from("audit_logs")
          .select("actor_id,details").eq("escola_id", escolaId)
          .eq("entity_id", origin.id).eq("action", "MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO")
          .order("id", { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null }),
        history ? supabase.from("historico_snapshot_locks")
          .select("status").eq("escola_id", escolaId)
          .eq("matricula_id", origin.id).eq("ano_letivo_id", origin.session_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (ratificationError || lockError) throw ratificationError ?? lockError;
      const hasRatification = (ratifications ?? []).some((row: any) =>
        Boolean(row.actor_id) && row.details?.ratificacao === true &&
        ExactHistoricalDecisionRoles.has(String(row.details?.papel_autorizado ?? "")) &&
        row.details?.fonte === "declaracao_administrativa_escola" &&
        row.details?.historico_ano_id === history?.id &&
        row.details?.resultado_final === history?.resultado_final &&
        String(row.details?.referencia_documental ?? "").trim().length >= 8 &&
        String(row.details?.motivo ?? "").trim().length >= 12);
      const sourceConsistent = history
        ? origin.status === "concluido" && origin.status_fecho_origem === "override_admin"
          && history.matricula_id === origin.id && history.ano_letivo_id === origin.session_id
        : origin.status === "pendente";
      const legalConflict = Boolean(history &&
        ((history.snapshot_status === "fechado" &&
          (!hasRatification || lock?.status !== "fechado")) ||
         !["aberto", "fechado"].includes(String(history.snapshot_status ?? ""))));
      const temNotasLancadas = (existingNotes ?? []).length > 0;
      // A numeric pauta must match the actual source grading regime.
      // Preschool qualitative assessment must not be stored as a 0–20 grade.
      const numericPauta = ["quantitativa_primario", "quantitativa_secundario"]
        .includes(String(sourceRegime?.escala ?? ""));
      const gradeSourceEligible = Boolean(numericPauta && isClosedSourceYear &&
        Number(currentYear?.ano) > Number(origin.ano_letivo) &&
        origin.status === "pendente" && origin.ativo === false &&
        (origin.status_fecho_origem === "manual" || origin.status_fecho_origem == null) &&
        !history && !legalConflict);
      const documentaryEligible = Boolean(cohort && isClosedSourceYear &&
        sourceConsistent && !legalConflict);
      const { data: recoveryRequest, error: recoveryRequestError } = await supabase
        .from("balcao_historic_recovery_requests")
        .select("id,created_at,motivo")
        .eq("escola_id", escolaId)
        .eq("matricula_id", origin.id).eq("status", "pendente")
        .maybeSingle();
      if (recoveryRequestError) throw recoveryRequestError;
      // Real grades transcribed from the school's physical pauta are the
      // normal path, including before the first grade is entered. Never
      // demand documentary ratification when a quantitative source is
      // eligible for audited historical grade entry. Keep the documentary
      // alternative only for sources that cannot accept numerical grades.
      const state = !history?.resultado_final
        ? gradeSourceEligible ? "notas"
          : documentaryEligible ? "decisao" : "indisponivel"
        : !documentaryEligible ? "indisponivel"
          : !hasRatification ? "ratificacao"
          : history.snapshot_status === "aberto" ? "fecho"
          : "concluido";
      const eligible = gradeSourceEligible || documentaryEligible;
      return NextResponse.json({
        ok: true, matricula_id: origin.id, estado: state,
        permite_escrita: permiteEscrita,
        // Visible guidance only; never infers a missing mark or academic approval.
        tem_notas_reais: temNotasLancadas,
        permite_confirmar_resultado: permiteEscrita && isClosedSourceYear && sourceConsistent && !legalConflict && !temNotasLancadas && (!history || history.snapshot_status === "aberto") && Number(currentYear?.ano) > Number(origin.ano_letivo),
        permite_conclusao_ciclo: allowsCycleCompletion(sourceRegime),
        permite_notas_historicas: Boolean(permiteNotasHistoricas) && gradeSourceEligible,
        permite_pedir_intervencao: eligible && (state === "decisao" || state === "notas" ||
          state === "ratificacao" || state === "fecho"),
        pedido_regularizacao: recoveryRequest
          ? { id: recoveryRequest.id, criado_em: recoveryRequest.created_at, motivo: recoveryRequest.motivo }
          : null,
        origem_ano: origin.ano_letivo,
        origem_status: origin.status, resultado_confirmado: history?.resultado_final ?? null,
        coorte: cohort?.record?.codigo ?? null,
        mensagem: !isClosedSourceYear ? "Este ano de origem ainda não está encerrado; utilize a avaliação académica normal."
          : temNotasLancadas ? "Continue a lançar as notas reais em falta. A decisão será calculada pelo RAA."
          : !cohort && !gradeSourceEligible ? "A origem não está elegível para regularização documental nem lançamento retroativo."
          : legalConflict ? "O histórico foi fechado ou reaberto sem a ratificação necessária; a direção deve rever o fecho legal."
          : !eligible ? "Há divergência na origem ou no histórico; a direção deve rever o vínculo."
          : null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const parsed = Params.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Filtro inválido" }, { status: 400 });

    const { data: current, error: currentError } = await supabase
      .from("anos_letivos").select("ano").eq("escola_id", escolaId)
      .eq("ativo", true).order("ano", { ascending: false }).limit(1).maybeSingle();
    if (currentError) throw currentError;
    const ano = parsed.data.ano ?? (Number(current?.ano ?? new Date().getFullYear()) - 1);
    const { data: schoolYear, error: yearError } = await supabase
      .from("anos_letivos").select("id").eq("escola_id", escolaId)
      .eq("ano", ano).maybeSingle();
    if (yearError) throw yearError;
    if (!schoolYear) return NextResponse.json({ ok: false, error: "Ano letivo não configurado nesta escola." }, { status: 404 });
    const pagina = parsed.data.pagina;
    const from = (pagina - 1) * 30;
    const to = from + 29;

    if (parsed.data.tipo === "pendentes") {
      const { data, count, error: listError } = await supabase
        .from("matriculas")
        .select("id,aluno_id,ano_letivo,status,created_at,turma_id,alunos:aluno_id(nome,nome_completo,numero_processo),turmas:turma_id(nome)", { count: "exact" })
        .eq("escola_id", escolaId).eq("ano_letivo", ano).eq("status", "pendente")
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .range(from, to);
      if (listError) throw listError;
      const rows = data ?? [];
      const ids = rows.map((m: any) => m.id as string);
      const students = rows.map((m: any) => m.aluno_id as string);
      const [cohorts, dests, grades] = await Promise.all([
        ids.length ? supabase.from("academic_transition_cohort_members")
          .select("matricula_origem_id,status,cohort:academic_transition_cohorts!inner(ativo,codigo,modo,ano_origem,ano_destino)")
          .eq("escola_id", escolaId).in("matricula_origem_id", ids) : Promise.resolve({ data: [], error: null }),
        students.length ? supabase.from("matriculas").select("id,aluno_id,turma_id,origem_transicao_matricula_id,ano_letivo,status,ativo")
          .eq("escola_id", escolaId).in("aluno_id", students).gt("ano_letivo", ano)
          .order("ano_letivo", { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("notas").select("matricula_id").eq("escola_id", escolaId)
          .in("matricula_id", ids).limit(500) : Promise.resolve({ data: [], error: null }),
      ]);
      if (cohorts.error || dests.error || grades.error) throw cohorts.error ?? dests.error ?? grades.error;
      // Only classroom identity is required: no gradebook read or inferred academic result.
      const turmaIds = [...new Set([
        ...rows.map((m: any) => m.turma_id as string | null),
        ...(dests.data ?? []).map((d: any) => d.turma_id as string | null),
      ].filter((id): id is string => typeof id === "string" && id.length > 0))];
      const { data: classRows, error: classError } = turmaIds.length
        ? await supabase.from("turmas").select("id,classes:classe_id(nome,numero)")
          .eq("escola_id", escolaId).in("id", turmaIds)
        : { data: [], error: null };
      if (classError) throw classError;
      const classeByTurma = new Map<string, any>(
        (classRows ?? []).map((t: any): [string, any] => [String(t.id), first(t.classes)]),
      );
      const members = new Map<string, any>();
      for (const member of cohorts.data ?? []) members.set(member.matricula_origem_id, member);
      const destinations = new Map<string, any>();
      for (const destination of dests.data ?? []) {
        const current = destinations.get(destination.aluno_id);
        if (!current || destination.ativo) destinations.set(destination.aluno_id, destination);
      }
      const gradeIds = new Set((grades.data ?? []).map((n: any) => n.matricula_id as string));
      return NextResponse.json({
        ok: true, tipo: "pendentes", ano, pagina, total: count ?? 0, permite_escrita: permiteEscrita,
        items: rows.map((m: any) => {
          const student = first(m.alunos);
          const turma = first(m.turmas);
          const member = members.get(m.id);
          const cohort = first(member?.cohort);
          const next = destinations.get(m.aluno_id);
          const comparison = compareNextYearEnrollment({
            matriculaOrigemId: m.id,
            classeOrigem: classeByTurma.get(m.turma_id) ?? null,
            destino: next ? {
              origem_transicao_matricula_id: next.origem_transicao_matricula_id,
              classe: classeByTurma.get(next.turma_id) ?? null,
            } : null,
          });
          const eligible = member?.status === "elegivel" && cohort?.ativo === true
            && Number(cohort?.ano_origem) === ano && Number(cohort?.ano_destino) > ano;
          return {
            matricula_id: m.id, aluno_id: m.aluno_id,
            aluno_nome: student?.nome_completo ?? student?.nome ?? "Aluno sem nome",
            numero_processo: student?.numero_processo ?? null,
            turma_nome: turma?.nome ?? "Turma não identificada",
            resultado_registado: null, snapshot_status: null, ratificado: false,
            coorte_autorizada: eligible, coorte: eligible ? cohort?.codigo : null,
            possui_notas: gradeIds.has(m.id),
            destino_ativo: next?.ativo === true,
            destino_vinculado: next?.origem_transicao_matricula_id === m.id,
            destino_ano: next?.ano_letivo ?? null,
            alertas_transicao: comparison.alertas,
            classe_origem_numero: comparison.classe_origem,
            classe_destino_numero: comparison.classe_destino,
            proximo_passo: comparison.alertas.length > 0
              ? "Conferir a divergência entre anos e a documentação escolar. Não atribuir notas ou aprovação pela turma destino."
              : eligible
              ? "Conferir a decisão da escola e registar a referência documental. A matrícula destino não prova aprovação."
              : "Regularizar a origem com a secretaria; não existe coorte assistida válida.",
          };
        }),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data, count, error: historyError } = await supabase
      .from("historico_anos")
      .select("id,matricula_id,aluno_id,ano_letivo,resultado_final,snapshot_status,alunos:aluno_id(nome,nome_completo,numero_processo)", { count: "exact" })
      .eq("escola_id", escolaId).eq("ano_letivo", ano)
      .eq("snapshot_status", "aberto")
      .order("updated_at", { ascending: true }).order("id", { ascending: true })
      .range(from, to);
    if (historyError) throw historyError;
    const rows = data ?? [];
    const ids = rows.map((h: any) => h.matricula_id as string).filter(Boolean);
    const [origins, audit] = await Promise.all([
      ids.length ? supabase.from("matriculas").select("id,status,status_fecho_origem").eq("escola_id", escolaId)
        .in("id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("audit_logs")
        .select("entity_id,actor_id,action,details").eq("escola_id", escolaId)
        .eq("action", "MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO")
        .in("entity_id", ids).limit(500) : Promise.resolve({ data: [], error: null }),
    ]);
    if (origins.error || audit.error) throw origins.error ?? audit.error;
    const sourceById = new Map<string, any>((origins.data ?? []).map((m: any): [string, any] => [String(m.id), m]));
    const signed = new Set((audit.data ?? [])
      .filter((a: any) => Boolean(a.actor_id) && a.details?.ratificacao === true &&
        ExactHistoricalDecisionRoles.has(String(a.details?.papel_autorizado ?? "")))
      .map((a: any) => String(a.entity_id)));
    return NextResponse.json({
      ok: true, tipo: "historicos", ano, pagina, total: count ?? 0, permite_escrita: permiteEscrita,
      items: rows.map((h: any) => {
        const student = first(h.alunos);
        const m: any = sourceById.get(h.matricula_id);
        const ratificado = signed.has(h.matricula_id);
        return {
          matricula_id: h.matricula_id, aluno_id: h.aluno_id,
          aluno_nome: student?.nome_completo ?? student?.nome ?? "Aluno sem nome",
          numero_processo: student?.numero_processo ?? null,
          turma_nome: null, resultado_registado: h.resultado_final,
          status_origem: m?.status ?? null, snapshot_status: h.snapshot_status,
          ratificado, coorte_autorizada: true,
          proximo_passo: ratificado
            ? "Conferir as pautas e confirmar o fecho legal pelo fluxo oficial."
            : "A direção deve ratificar a decisão escolar com referência documental antes do fecho legal.",
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[academic-reconciliation] GET failed", error);
    return NextResponse.json({ ok: false, error: "Não foi possível consultar a reconciliação académica." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, escolaId, error } = await schoolSession();
    if (error || !escolaId) return error!;
    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "EVIDENCIA_OBRIGATORIA",
        error: "Indique uma fundamentação válida. Para uma decisão escolar, anexe a referência documental e confirme o resultado." },
      { status: 400 });
    }
    const body = parsed.data;
    if (body.acao === "solicitar_intervencao") {
      // Finance operators may request academic work, but cannot sign a result
      // or write marks. The RPC verifies the exact tenant/role/source and
      // deduplicates concurrent requests for the same student.
      const { data, error: requestError } = await supabase.rpc(
        "solicitar_regularizacao_historica_balcao" as any,
        { p_escola_id: escolaId, p_matricula_id: body.matricula_id, p_motivo: body.motivo } as any,
      );
      if (requestError || (data as any)?.ok !== true) {
        return NextResponse.json({ ok: false,
          code: requestError?.code ?? "HISTORICAL_RECOVERY_REQUEST_FAILED",
          error: requestError?.message ?? "Não foi possível registar o pedido à direção." },
        { status: requestError?.code === "42501" ? 403 : 409 });
      }
      return NextResponse.json({ ok: true, mensagem: "Solicitação registada no processo para a direção académica.", pedido: data },
        { headers: { "Cache-Control": "no-store" } });
    }
    const allowed = await requireRoleInSchool({ supabase, escolaId, roles: [...WriteRoles] });
    if (allowed.error) return allowed.error;
    if (!(await canWriteHistoricalDecision(supabase, escolaId))) {
      return NextResponse.json({ ok: false, code: "HISTORICAL_DECISION_FORBIDDEN",
        error: "Este perfil não pode validar o histórico nesta escola." }, { status: 403 });
    }
    let data: any = null;
    let rpcError: any = null;
    if (body.acao === "concluir_ano_percurso") {
      ({ data, error: rpcError } = await supabase.rpc("balcao_concluir_ano_percurso", {
        p_escola_id: escolaId, p_matricula_id: body.matricula_id,
        p_resultado: body.resultado_confirmado ?? null, p_modo: body.modo,
      }));
    } else if (body.acao === "registar_decisao") {
      // Fail closed when an already-created next-year enrollment contradicts
      // the documentary decision. No automatic changes to either enrollment.
      const { data: origin, error: originError } = await supabase.from("matriculas")
        .select("id,aluno_id,ano_letivo,turma_id")
        .eq("escola_id", escolaId).eq("id", body.matricula_id).maybeSingle();
      if (originError) throw originError;
      if (!origin) return NextResponse.json({ ok: false, error: "Matrícula de origem inexistente nesta escola." }, { status: 404 });
      if (body.resultado_confirmado === "concluido") {
        const { data: regime, error: regimeError } = origin.turma_id
          ? await supabase.rpc("resolve_regime_academico", { p_turma_id: origin.turma_id })
          : { data: null, error: null };
        if (regimeError) throw regimeError;
        if (!allowsCycleCompletion(regime)) {
          return NextResponse.json({ ok: false, code: "ACADEMIC_CYCLE_NOT_FINAL",
            error: "Esta classe não conclui um ciclo de ensino. Utilize o resultado documental efetivamente comprovado." },
            { status: 409 });
        }
      }
      const { data: destination, error: destinationError } = await supabase.from("matriculas")
        .select("id,turma_id,origem_transicao_matricula_id,ano_letivo,ativo")
        .eq("escola_id", escolaId).eq("aluno_id", origin.aluno_id)
        .eq("ano_letivo", Number(origin.ano_letivo) + 1).maybeSingle();
      if (destinationError) throw destinationError;
      if (destination) {
        const ids = [origin.turma_id, destination.turma_id].filter((id): id is string => typeof id === "string" && id.length > 0);
        const { data: turmaRows, error: turmaError } = await supabase.from("turmas")
          .select("id,classes:classe_id(nome,numero)").eq("escola_id", escolaId).in("id", ids);
        if (turmaError) throw turmaError;
        const byId = new Map<string, any>((turmaRows ?? []).map((t: any): [string, any] => [String(t.id), first(t.classes)]));
        const comparison = compareNextYearEnrollment({
          matriculaOrigemId: origin.id,
          classeOrigem: byId.get(origin.turma_id) ?? null,
          destino: {
            origem_transicao_matricula_id: destination.origem_transicao_matricula_id,
            classe: byId.get(destination.turma_id) ?? null,
          },
        });
        if (comparison.alertas.includes("DESTINO_SEM_VINCULO") ||
            comparison.alertas.includes("VINCULO_DIVERGENTE") ||
            !confirmedOutcomeFitsDestination(body.resultado_confirmado, comparison, true)) {
          return NextResponse.json({
            ok: false, code: "TRANSICAO_ACADEMICA_DIVERGENTE",
            error: "A classe destino ou o vínculo entre matrículas contradiz a decisão. A direção deve rever a transição no Balcão antes de finalizar o histórico.",
            alertas: comparison.alertas,
          }, { status: 409 });
        }
      }
      ({ data, error: rpcError } = await supabase.rpc("finalizar_origem_academica", {
        p_escola_id: escolaId, p_matricula_id: body.matricula_id,
        p_resultado_final: body.resultado_confirmado,
        p_fonte: "declaracao_administrativa_escola",
        p_motivo: `${body.referencia_documental} — ${body.motivo}`,
        p_observacao: `Declaração escolar documentada: ${body.referencia_documental}`,
      }));
    } else if (body.acao === "ratificar") {
      ({ data, error: rpcError } = await supabase.rpc("ratificar_resultado_historico_escola", {
        p_escola_id: escolaId, p_matricula_id: body.matricula_id,
        p_resultado_confirmado: body.resultado_confirmado,
        p_referencia_documental: body.referencia_documental,
        p_motivo: body.motivo,
      }));
    } else {
      // Only a properly signed documentary record can be legally closed.
      const { data: historical, error: historicalError } = await supabase
        .from("historico_anos").select("id,resultado_final,snapshot_status,matricula_id")
        .eq("escola_id", escolaId).eq("matricula_id", body.matricula_id).maybeSingle();
      if (historicalError) throw historicalError;
      if (!historical?.resultado_final || historical.snapshot_status !== "aberto") {
        return NextResponse.json({ ok: false, code: "HISTORICAL_DECISION_NOT_READY",
          error: "Registe e ratifique uma decisão documental antes do fecho." }, { status: 409 });
      }
      const { data: signatures, error: signatureError } = await supabase.from("audit_logs")
        .select("actor_id,details").eq("escola_id", escolaId)
        .eq("entity_id", body.matricula_id).eq("action", "MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO")
        .order("id", { ascending: false }).limit(100);
      if (signatureError) throw signatureError;
      const signed = (signatures ?? []).some((row: any) =>
        Boolean(row.actor_id) && row.details?.ratificacao === true &&
        ExactHistoricalDecisionRoles.has(String(row.details?.papel_autorizado ?? "")) &&
        row.details?.fonte === "declaracao_administrativa_escola" &&
        row.details?.historico_ano_id === historical.id &&
        row.details?.resultado_final === historical.resultado_final &&
        String(row.details?.referencia_documental ?? "").trim().length >= 8 &&
        String(row.details?.motivo ?? "").trim().length >= 12);
      if (!signed) return NextResponse.json({ ok: false, code: "HISTORICAL_RATIFICATION_REQUIRED",
        error: "A direção deve ratificar a decisão documental antes do fecho legal." }, { status: 409 });
      const { data: enrollment, error: lookupError } = await supabase
        .from("matriculas").select("id,session_id").eq("escola_id", escolaId)
        .eq("id", body.matricula_id).maybeSingle();
      if (lookupError || !enrollment?.session_id) return NextResponse.json({
        ok: false, code: "ANO_ORIGEM_INVALIDO",
        error: "Não foi possível identificar o ano letivo do histórico. Encaminhe para revisão académica.",
      }, { status: 409 });
      ({ data, error: rpcError } = await supabase.rpc("historico_set_snapshot_state", {
        p_escola_id: escolaId, p_matricula_ids: [body.matricula_id],
        p_ano_letivo_id: enrollment.session_id, p_novo_estado: "fechado",
        p_motivo: body.motivo, p_run_id: null,
      }));
    }
    if (rpcError || data?.ok === false) {
      const errorMessage = String(rpcError?.message ?? data?.error ?? data?.motivos?.[0] ?? "A operação não foi concluída.");
      const code = errorMessage.includes(":") ? errorMessage.split(":")[0] : "ACADEMIC_RECONCILIATION_BLOCKED";
      return NextResponse.json({ ok: false, code, error: errorMessage }, { status: 409 });
    }
    return NextResponse.json({ ok: true, acao: body.acao, resultado: data,
      mensagem: body.acao === "fechar_historico"
        ? "Histórico fechado pelo fluxo oficial. O resultado já pode ser consultado pelos portais autorizados."
        : body.acao === "ratificar"
          ? "Decisão ratificada. O histórico continua aberto até à confirmação expressa do fecho legal."
          : "Decisão académica registada. O histórico permanece aberto até à validação e ao fecho legal.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[academic-reconciliation] POST failed", error);
    return NextResponse.json({ ok: false, error: "Ocorreu um erro ao reconciliar a decisão. Não foi aplicada nenhuma decisão automática." }, { status: 500 });
  }
}
