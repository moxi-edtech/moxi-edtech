import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = [
  "secretaria", "secretaria_financeiro", "admin_secretaria", "admin_secretario",
  "admin", "admin_escola", "staff_admin", "admin_financeiro", "diretor",
] as const;

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Data inválida");
const hour = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const fields = z.object({
  turma_id: uuid,
  turma_disciplina_id: uuid,
  periodo_letivo_id: uuid,
  tipo: z.enum(["Teste", "Prova trimestral", "Trabalho", "Outra"]),
  data: date,
  inicio: hour,
  fim: hour.nullable(),
  descricao: z.string().trim().max(500).nullable(),
}).refine((s) => !s.fim || s.fim > s.inicio, {
  message: "A hora de término deve ser posterior ao início.",
});
const payload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), items: z.array(fields).min(1).max(500) }),
  z.object({ action: z.literal("edit"), id: uuid, data: date, inicio: hour,
    fim: hour.nullable(), descricao: z.string().trim().max(500).nullable(),
    tipo: z.enum(["Teste", "Prova trimestral", "Trabalho", "Outra"]) }),
  z.object({ action: z.literal("publish"), ids: z.array(uuid).min(1).max(1000) }),
  z.object({ action: z.literal("cancel"), id: uuid }),
]);

async function authorize(id: string) {
  const db = await supabaseServerTyped<any>();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const resolved = await resolveEscolaParam(db, id);
  if (!resolved.escolaId) {
    return { error: NextResponse.json({ ok: false, error: "Escola inexistente" }, { status: 404 }) };
  }
  const escolaId = await resolveEscolaIdForUser(db, user.id, resolved.escolaId);
  if (escolaId !== resolved.escolaId) {
    return { error: NextResponse.json({ ok: false, error: "Outra escola não autorizada" }, { status: 403 }) };
  }
  const check = await requireRoleInSchool({ supabase: db, escolaId, roles: [...ROLES] });
  if (check.error) return { error: check.error };
  return { db, escolaId, user };
}

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const auth = await authorize((await context.params).id);
    if (auth.error) return auth.error;
    const { db, escolaId } = auth;
    const search = new URL(req.url).searchParams;
    const requestedYear = search.get("ano_letivo_id");
    if (requestedYear && !uuid.safeParse(requestedYear).success) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido" }, { status: 400 });
    }
    let yearQuery = db.from("anos_letivos").select("id,ano,ativo,data_inicio,data_fim")
      .eq("escola_id", escolaId).order("ano", { ascending: false }).limit(1);
    yearQuery = requestedYear ? yearQuery.eq("id", requestedYear) : yearQuery.eq("ativo", true);
    const { data: ano, error: yearError } = await yearQuery.maybeSingle();
    if (yearError) throw yearError;
    if (!ano) return NextResponse.json({ ok: true, ano: null, periodos: [], turmas: [], disciplinas: [], ofertas: [], items: [], historico: [] });

    const [periods, classes, saved, offerings] = await Promise.all([
      db.from("periodos_letivos").select("id,numero,data_inicio,data_fim,offering_id")
        .eq("escola_id", escolaId).eq("ano_letivo_id", ano.id).order("numero").limit(150),
      db.from("turmas").select("id,nome,curso_id")
        .eq("escola_id", escolaId).eq("ano_letivo_id", ano.id).order("nome").limit(500),
      db.from("calendario_avaliacoes")
        .select("id,ano_letivo_id,periodo_letivo_id,turma_id,turma_disciplina_id,tipo,descricao,data,inicio,fim,estado,updated_at,updated_by,published_at")
        .eq("escola_id", escolaId).eq("ano_letivo_id", ano.id).order("data").limit(2000),
      db.from("school_education_offerings").select("id,course_id")
        .eq("escola_id", escolaId).eq("status", "active").limit(500),
    ]);
    if (periods.error || classes.error || saved.error || offerings.error) throw periods.error ?? classes.error ?? saved.error ?? offerings.error;
    if ((periods.data ?? []).length >= 150 || (classes.data ?? []).length >= 500 || (saved.data ?? []).length >= 2000) {
      return NextResponse.json({ ok: false, error: "O catálogo excede o limite seguro. Contacte a administração." }, { status: 409 });
    }
    const turmaIds = (classes.data ?? []).map((v: any) => v.id);
    const td = turmaIds.length
      ? await db.from("turma_disciplinas").select("id,turma_id,curso_matriz_id")
          .eq("escola_id", escolaId).in("turma_id", turmaIds).limit(3000)
      : { data: [], error: null };
    if (td.error) throw td.error;
    if ((td.data ?? []).length >= 3000) {
      return NextResponse.json({ ok: false, error: "Muitas disciplinas para o mesmo pedido." }, { status: 409 });
    }
    const matrizIds = [...new Set((td.data ?? []).map((v: any) => v.curso_matriz_id).filter(Boolean))] as string[];
    const matrices = matrizIds.length
      ? await db.from("curso_matriz").select("id,disciplina_id")
          .eq("escola_id", escolaId).in("id", matrizIds).limit(3000)
      : { data: [], error: null };
    if (matrices.error) throw matrices.error;
    const subjectIds = [...new Set((matrices.data ?? []).map((v: any) => v.disciplina_id).filter(Boolean))] as string[];
    const catalog = subjectIds.length
      ? await db.from("disciplinas_catalogo").select("id,nome")
          .eq("escola_id", escolaId).in("id", subjectIds).limit(3000)
      : { data: [], error: null };
    if (catalog.error) throw catalog.error;
    const idToSubject = new Map<string, string>((catalog.data ?? []).map((v: any): [string, string] => [v.id, v.nome]));
    const matrixToSubject = new Map<string, string>((matrices.data ?? []).map((v: any): [string, string] => [v.id, idToSubject.get(v.disciplina_id) ?? "Disciplina"]));
    const disciplinas = (td.data ?? []).map((v: any) => ({
      id: v.id, turma_id: v.turma_id,
      nome: matrixToSubject.get(v.curso_matriz_id) ?? "Disciplina não identificada",
    })).sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt"));

    const auditId = search.get("historico");
    let historico: any[] = [];
    if (auditId) {
      if (!uuid.safeParse(auditId).success) return NextResponse.json({ ok: false, error: "Identificador inválido" }, { status: 400 });
      const { data, error } = await db.from("calendario_avaliacoes_auditoria")
        .select("id,actor_id,acao,antes,depois,ocorrido_em")
        .eq("escola_id", escolaId).eq("avaliacao_id", auditId)
        .order("ocorrido_em", { ascending: false }).limit(100);
      if (error) throw error;
      const logs = data ?? [];
      const userIds = [...new Set(logs.map((h: { actor_id: string }) => h.actor_id).filter(Boolean))];
      const people = userIds.length
        ? await db.from("profiles").select("user_id,nome")
            .eq("escola_id", escolaId).in("user_id", userIds).limit(100)
        : { data: [], error: null };
      // Auditoria continua disponível mesmo quando a política de perfis restringe nomes.
      const byUser = new Map<string, string>((people.data ?? []).map((p: { user_id: string; nome: string }): [string, string] =>
        [p.user_id, p.nome]));
      historico = logs.map((h: { actor_id: string }) => ({ ...h, actor_nome: byUser.get(h.actor_id) ?? null }));
    }
    return NextResponse.json({ ok: true, ano, periodos: periods.data, turmas: classes.data,
      disciplinas, ofertas: offerings.data, items: saved.data, historico }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[calendario-avaliacoes/GET]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível consultar o calendário." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authorize((await context.params).id);
    if (auth.error) return auth.error;
    const { db, escolaId, user } = auth;
    const parsed = payload.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
    const input = parsed.data;
    const { data: ano, error: yearError } = await db.from("anos_letivos")
      .select("id").eq("escola_id", escolaId).eq("ativo", true).limit(1).maybeSingle();
    if (yearError) throw yearError;
    if (!ano) return NextResponse.json({ ok: false, error: "Não existe ano letivo ativo." }, { status: 409 });

    let result;
    if (input.action === "create") {
      const unique = new Set(input.items.map((i) => [i.turma_disciplina_id, i.periodo_letivo_id, i.tipo, i.data, i.inicio].join(":")));
      if (unique.size !== input.items.length) return NextResponse.json({ ok: false, error: "Existem avaliações duplicadas na seleção." }, { status: 400 });
      result = await db.from("calendario_avaliacoes").insert(input.items.map((item) => ({
        ...item, escola_id: escolaId, ano_letivo_id: ano.id, estado: "rascunho",
        created_by: user.id, updated_by: user.id,
      }))).select("id");
    } else if (input.action === "edit") {
      result = await db.from("calendario_avaliacoes")
        .update({ data: input.data, inicio: input.inicio, fim: input.fim, descricao: input.descricao,
          tipo: input.tipo, updated_by: user.id })
        .eq("escola_id", escolaId).eq("ano_letivo_id", ano.id).eq("id", input.id)
        .neq("estado", "cancelado").select("id");
    } else if (input.action === "cancel") {
      result = await db.from("calendario_avaliacoes")
        .update({ estado: "cancelado", updated_by: user.id })
        .eq("escola_id", escolaId).eq("ano_letivo_id", ano.id).eq("id", input.id)
        .neq("estado", "cancelado").select("id");
    } else {
      result = await db.rpc("publicar_calendario_avaliacoes", { p_ids: input.ids });
    }
    if (result.error) {
      const conflict = result.error.code === "23P01" || result.error.message?.includes("calendario_avaliacoes_turma_sem_sobreposicao");
      const duplicate = result.error.code === "23505";
      const message = conflict
        ? "Esta turma já tem uma avaliação que coincide com esse horário. Escolha outra hora ou data."
        : duplicate ? "Já existe esta avaliação com os mesmos dados. Consulte a agenda antes de criar outra."
        : result.error.message;
      return NextResponse.json({ ok: false, error: message }, { status: 409 });
    }
    if (input.action !== "publish" && (!result.data || result.data.length === 0)) {
      return NextResponse.json({ ok: false, error: "Avaliação não encontrada ou sem alterações." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, count: input.action === "publish" ? result.data : result.data.length },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[calendario-avaliacoes/POST]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar a operação." }, { status: 500 });
  }
}
