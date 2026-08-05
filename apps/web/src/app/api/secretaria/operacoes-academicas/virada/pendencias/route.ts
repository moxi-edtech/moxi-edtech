import { NextRequest, NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PendingItem = {
  id: string;
  tipo: "aluno" | "turma" | "disciplina" | "documento";
  titulo: string;
  detalhe: string;
  ano_letivo: number | null;
  aluno_id: string | null;
  turma_id: string | null;
  matricula_id: string | null;
  href: string | null;
};

function asText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export async function GET(request: NextRequest) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  const authz = await authorizeEscolaAction(supabase as any, escolaId, auth.user.id, ["configurar_escola"]);
  if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  const db = supabase as any;

  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo") || "all";
  const q = (params.get("q") || "").trim().toLowerCase();
  const parsedYear = Number(params.get("ano"));
  const ano = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : null;
  const parsedLimit = Number(params.get("limit"));
  const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 50;
  const wants = (value: PendingItem["tipo"]) => tipo === "all" || tipo === value;

  const [matriculasRes, turmasRes, historicoRes, pautasRes] = await Promise.all([
    wants("aluno")
      ? db.from("matriculas").select("id,aluno_id,turma_id,ano_letivo,status,alunos:aluno_id(id,nome,nome_completo,numero_processo),turmas:turma_id(id,nome)").eq("escola_id", escolaId).in("status", ["pendente", "rascunho", "indefinido"]).order("ano_letivo", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    wants("turma")
      ? db.from("turmas").select("id,nome,ano_letivo,session_id").eq("escola_id", escolaId).is("session_id", null).order("ano_letivo", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    wants("disciplina")
      ? db.from("historico_anos").select("id,aluno_id,turma_id,ano_letivo,resultado_final,alunos:aluno_id(nome,nome_completo),turmas:turma_id(nome),historico_disciplinas(id,disciplina_id,media_final,resultado)").eq("escola_id", escolaId).order("ano_letivo", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    wants("documento")
      ? db.from("pautas_lote_jobs").select("id,status,tipo,documento_tipo,created_at,processed,total_turmas,failed_count,error_message").eq("escola_id", escolaId).in("status", ["FAILED", "PROCESSING", "PENDING", "RUNNING"]).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const items: PendingItem[] = [];
  for (const row of (matriculasRes.data ?? []) as any[]) {
    if (ano !== null && Number(row.ano_letivo) !== ano) continue;
    const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
    const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
    const nome = asText(aluno?.nome_completo || aluno?.nome || aluno?.numero_processo || row.aluno_id);
    if (q && !`${nome} ${turma?.nome || ""}`.toLowerCase().includes(q)) continue;
    items.push({ id: `matricula:${row.id}`, tipo: "aluno", titulo: nome, detalhe: `Matrícula ${row.status} · turma ${turma?.nome || "sem turma"}`, ano_letivo: row.ano_letivo ?? null, aluno_id: row.aluno_id, turma_id: row.turma_id, matricula_id: row.id, href: `/secretaria/alunos/${row.aluno_id}?tab=historico&ano=${row.ano_letivo || ""}` });
  }
  for (const row of (turmasRes.data ?? []) as any[]) {
    if (ano !== null && Number(row.ano_letivo) !== ano) continue;
    if (q && !asText(row.nome).toLowerCase().includes(q)) continue;
    items.push({ id: `turma:${row.id}`, tipo: "turma", titulo: asText(row.nome), detalhe: "Turma sem sessão curricular associada", ano_letivo: row.ano_letivo ?? null, aluno_id: null, turma_id: row.id, matricula_id: null, href: null });
  }
  for (const row of (historicoRes.data ?? []) as any[]) {
    if (ano !== null && Number(row.ano_letivo) !== ano) continue;
    const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
    const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
    for (const disciplina of (row.historico_disciplinas ?? []) as any[]) {
      if (disciplina.media_final != null && disciplina.resultado) continue;
      const nome = asText(aluno?.nome_completo || aluno?.nome || row.aluno_id);
      const titulo = `${nome} · disciplina ${asText(disciplina.disciplina_id)}`;
      if (q && !`${titulo} ${turma?.nome || ""}`.toLowerCase().includes(q)) continue;
      items.push({ id: `disciplina:${disciplina.id}`, tipo: "disciplina", titulo, detalhe: `Histórico ${row.ano_letivo}: ${disciplina.media_final == null ? "média em falta" : "resultado em falta"}`, ano_letivo: row.ano_letivo ?? null, aluno_id: row.aluno_id, turma_id: row.turma_id, matricula_id: null, href: `/secretaria/alunos/${row.aluno_id}?tab=historico&ano=${row.ano_letivo}` });
    }
  }
  for (const row of (pautasRes.data ?? []) as any[]) {
    items.push({ id: `documento:${row.id}`, tipo: "documento", titulo: asText(row.documento_tipo || row.tipo || "pauta anual"), detalhe: `${asText(row.status)}${row.error_message ? ` · ${row.error_message}` : ""}`, ano_letivo: null, aluno_id: null, turma_id: null, matricula_id: null, href: null });
  }

  const ordered = items.sort((a, b) => (b.ano_letivo ?? 0) - (a.ano_letivo ?? 0)).slice(0, limit);
  return NextResponse.json({ ok: true, ano, total: ordered.length, items: ordered });
}
