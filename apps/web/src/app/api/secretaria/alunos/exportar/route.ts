import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { listAlunos, listAllAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const HEADERS = [
  "nome",
  "email",
  "responsavel",
  "telefone_responsavel",
  "status",
  "numero_login",
  "numero_processo",
  "origem",
  "created_at",
];

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const toCsv = (rows: any[]) => {
  const lines = [HEADERS.join(",")];
  rows.forEach((row) => {
    const line = HEADERS.map((key) => {
      const value = row?.[key];
      return escapeCsv(value === null || value === undefined ? "" : String(value));
    }).join(",");
    lines.push(line);
  });
  return `\ufeff${lines.join("\n")}`;
};

export async function GET(req: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const filters = parseAlunoListFilters(url);
    const exportAll = url.searchParams.get("all") === "1";

    const items = exportAll
      ? await listAllAlunos(supabase, escolaId, filters, { includeFinanceiro: true, includeResumo: true })
      : (await listAlunos(supabase, escolaId, filters, { includeFinanceiro: true, includeResumo: true })).items;

    const csv = toCsv(items);
    const status = filters.status ?? "ativo";
    const filename = `alunos-${status}-${exportAll ? "todos" : "pagina"}-${Date.now()}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("[alunos export error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}
