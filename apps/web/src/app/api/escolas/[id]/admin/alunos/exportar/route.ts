import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { listAllAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
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

const EXPORT_ROLES = ["admin", "admin_escola", "staff_admin", "secretaria"] as const;

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
    const rendered = await renderAlunosExport(rows, format);
    const status = filters.status ?? "ativo";
    const segmento = filters.situacaoFinanceira === "em_atraso" ? "inadimplentes" : status;

    return buildDownloadResponse(rendered, `alunos-${segmento}-${Date.now()}`);
  } catch (error) {
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

    const format = parseAlunoExportFormat(payload?.tipo ?? "excel");
    const rendered = await renderAlunosExport(rows, format);

    return buildDownloadResponse(rendered, `alunos-seleccionados-${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin alunos selected export error]", error);
    return NextResponse.json({ ok: false, error: message || "Erro desconhecido" }, { status: 500 });
  }
}
