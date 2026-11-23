import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";
import { InvalidAlunoFiltersError, listAllAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import { loadAlunosPdfInstitutionalContext } from "@/lib/services/alunosExportPdfContext.server";
import {
  parseAlunoExportFormat,
  renderAlunosExport,
  sortAlunoExportRows,
} from "@/lib/services/alunosExport.server";
import type { Database } from "~types/supabase";
import type { AlunoListItem } from "@/lib/schemas/aluno.schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const EXPORT_ROLES = K12_ADMIN_SECRETARIA_ROLE_GROUP;

async function resolveContext(req: Request, escolaParam: string) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaParam);
  if (!resolvedEscolaId) {
    return { error: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  const { error: roleError } = await requireRoleInSchool({
    supabase,
    escolaId: resolvedEscolaId,
    roles: [...EXPORT_ROLES],
  });
  if (roleError) return { error: roleError };

  return { supabase, escolaId: resolvedEscolaId, url: new URL(req.url) };
}

function buildDownloadResponse(
  rendered: Awaited<ReturnType<typeof renderAlunosExport>>,
  filename: string
) {
  return new NextResponse(rendered.body as BodyInit, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${filename}.${rendered.extension}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const context = await resolveContext(req, id);
    if ("error" in context) return context.error;

    const filters = parseAlunoListFilters(context.url);
    const format = parseAlunoExportFormat(context.url.searchParams.get("tipo"));
    const rows = sortAlunoExportRows(
      await listAllAlunos(context.supabase, context.escolaId, filters, {
        includeFinanceiro: true,
        includeResumo: true,
      })
    );
    const pdfContext = format === "pdf"
      ? await loadAlunosPdfInstitutionalContext(context.supabase, context.escolaId, filters)
      : undefined;
    const rendered = await renderAlunosExport(rows, format, pdfContext);
    const status = filters.status ?? "ativo";
    const segmento = filters.situacaoFinanceira === "em_atraso" ? "inadimplentes" : status;

    return buildDownloadResponse(rendered, `alunos-${segmento}-${Date.now()}`);
  } catch (error) {
    if (error instanceof InvalidAlunoFiltersError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin alunos export error]", error);
    return NextResponse.json({ ok: false, error: message || "Erro desconhecido" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const context = await resolveContext(req, id);
    if ("error" in context) return context.error;

    const payload = (await req.json().catch(() => null)) as { ids?: string[]; tipo?: string } | null;
    const ids = Array.from(new Set((payload?.ids ?? []).filter(Boolean)));
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhum aluno seleccionado" }, { status: 400 });
    }

    const { data, error } = await context.supabase
      .from("alunos")
      .select(
        "id, nome, email, responsavel, responsavel_nome, responsavel_contato, encarregado_nome, encarregado_telefone, telefone_responsavel, status, numero_processo_login, numero_processo, created_at"
      )
      .eq("escola_id", context.escolaId)
      .in("id", ids);

    if (error) throw error;

    const rows = sortAlunoExportRows(
      ((data ?? []) as any[]).map(
        (row): AlunoListItem => ({
          id: row.id,
          aluno_id: row.id,
          origem: "aluno",
          nome: row.nome ?? null,
          email: row.email ?? null,
          responsavel:
            row.responsavel ?? row.responsavel_nome ?? row.encarregado_nome ?? null,
          telefone_responsavel:
            row.telefone_responsavel ?? row.responsavel_contato ?? row.encarregado_telefone ?? null,
          status: row.status ?? null,
          created_at: row.created_at ?? null,
          numero_processo_login: row.numero_processo_login ?? null,
          numero_processo: row.numero_processo ?? null,
        })
      )
    );

    // Os alunos selecionados também precisam das informações académicas do ano
    // ativo, não só dos dados pessoais. Evitar PDF com bolsa/classe vazias.
    const { data: anoAtivo, error: anoError } = await context.supabase
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", context.escolaId)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anoError) throw anoError;

    if (anoAtivo?.id) {
      const { data: matriculas, error: matriculasError } = await context.supabase
        .from("matriculas")
        .select("aluno_id, turma_id, status, bolsa_integral, updated_at, created_at")
        .eq("escola_id", context.escolaId)
        .eq("session_id", anoAtivo.id)
        .in("aluno_id", ids)
        .in("status", ["ativo", "ativa"])
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      if (matriculasError) throw matriculasError;
      const matriculaPorAluno = new Map<string, any>();
      for (const matricula of (matriculas ?? []) as any[]) {
        if (!matriculaPorAluno.has(matricula.aluno_id)) {
          matriculaPorAluno.set(matricula.aluno_id, matricula);
        }
      }
      const turmaIds = Array.from(new Set((matriculas ?? [])
        .map((matricula: any) => matricula.turma_id)
        .filter((id): id is string => Boolean(id))));
      const { data: turmas, error: turmasError } = turmaIds.length
        ? await context.supabase
            .from("turmas")
            .select("id, nome, turno, classes ( nome )")
            .eq("escola_id", context.escolaId)
            .in("id", turmaIds)
        : { data: [], error: null };
      if (turmasError) throw turmasError;

      const turmaPorId = new Map((turmas ?? []).map((turma: any) => [turma.id, turma]));
      for (let i = 0; i < rows.length; i++) {
        const matricula = matriculaPorAluno.get(rows[i].aluno_id ?? rows[i].id);
        if (!matricula) continue;
        const turma: any = turmaPorId.get(matricula.turma_id);
        const classe = Array.isArray(turma?.classes) ? turma.classes[0] : turma?.classes;
        rows[i] = {
          ...rows[i],
          status_matricula: "matriculado",
          turma_id: matricula.turma_id ?? null,
          turma_nome: turma?.nome ?? null,
          classe_nome: classe?.nome ?? null,
          turno: turma?.turno ?? null,
          bolsa_integral: matricula.bolsa_integral === true,
        };
      }
    }

    const format = parseAlunoExportFormat(payload?.tipo ?? "excel");
    const pdfContext = format === "pdf"
      ? await loadAlunosPdfInstitutionalContext(context.supabase, context.escolaId, {})
      : undefined;
    const rendered = await renderAlunosExport(rows, format, pdfContext);

    return buildDownloadResponse(rendered, `alunos-seleccionados-${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin alunos selected export error]", error);
    return NextResponse.json({ ok: false, error: message || "Erro desconhecido" }, { status: 500 });
  }
}
