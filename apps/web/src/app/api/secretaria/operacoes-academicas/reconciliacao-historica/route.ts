import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { compareNextYearEnrollment, confirmedOutcomeFitsDestination } from "@/lib/rematricula/compare-next-year-enrollment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ReadRoles = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;
const WriteRoles = ["admin", "admin_escola", "staff_admin"] as const;
const AcademicResult = z.enum(["aprovado", "reprovado", "concluido"]);
const Evidence = {
  matricula_id: z.string().uuid(),
  referencia_documental: z.string().trim().min(8).max(180),
  motivo: z.string().trim().min(12).max(500),
};

const ActionSchema = z.discriminatedUnion("acao", [
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
    const writeScope = await requireRoleInSchool({ supabase, escolaId, roles: [...WriteRoles] });
    const permiteEscrita = !writeScope.error;
    const parsed = Params.safeParse(Object.fromEntries(new URL(request.url).searchParams));
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
      .filter((a: any) => Boolean(a.actor_id) && Boolean(a.details?.motivo))
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
    const allowed = await requireRoleInSchool({ supabase, escolaId, roles: [...WriteRoles] });
    if (allowed.error) return allowed.error;
    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "EVIDENCIA_OBRIGATORIA",
        error: "Indique o resultado, a referência documental e o motivo. Para fechar o histórico, confirme explicitamente o fecho legal." },
      { status: 400 });
    }
    const body = parsed.data;
    let data: any = null;
    let rpcError: any = null;
    if (body.acao === "registar_decisao") {
      // Fail closed when an already-created next-year enrollment contradicts
      // the documentary decision. No automatic changes to either enrollment.
      const { data: origin, error: originError } = await supabase.from("matriculas")
        .select("id,aluno_id,ano_letivo,turma_id")
        .eq("escola_id", escolaId).eq("id", body.matricula_id).maybeSingle();
      if (originError) throw originError;
      if (!origin) return NextResponse.json({ ok: false, error: "Matrícula de origem inexistente nesta escola." }, { status: 404 });
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
