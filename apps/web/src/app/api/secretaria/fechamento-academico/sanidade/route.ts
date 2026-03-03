import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { executarValidacoesFechamento } from "../validacoes/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  acao: z.enum(["fechar_trimestre", "fechar_ano"]),
  ano_letivo_id: z.string().uuid(),
  periodo_letivo_id: z.string().uuid().optional(),
  turma_ids: z.string().optional(),
  format: z.enum(["json", "csv"]).optional(),
});

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      acao: url.searchParams.get("acao"),
      ano_letivo_id: url.searchParams.get("ano_letivo_id"),
      periodo_letivo_id: url.searchParams.get("periodo_letivo_id") || undefined,
      turma_ids: url.searchParams.get("turma_ids") || undefined,
      format: (url.searchParams.get("format") as "json" | "csv" | null) ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
    }

    const turmaIds = parsed.data.turma_ids?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];

    const relatorio = await executarValidacoesFechamento({
      supabase,
      escolaId,
      acao: parsed.data.acao,
      anoLetivoId: parsed.data.ano_letivo_id,
      periodoLetivoId: parsed.data.periodo_letivo_id,
      turmaIds,
    });

    if (parsed.data.format === "csv") {
      const header = "id,regra,severidade,turma_id,matricula_id,aluno_id,mensagem";
      const lines = relatorio.pendencias.map((p) =>
        [p.id, p.regra, p.severidade, p.turma_id ?? "", p.matricula_id ?? "", p.aluno_id ?? "", JSON.stringify(p.mensagem)]
          .map((x) => String(x).replaceAll("\n", " "))
          .join(",")
      );
      return new NextResponse([header, ...lines].join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=relatorio_sanidade_${parsed.data.acao}.csv`,
        },
      });
    }

    return NextResponse.json({ ok: true, relatorio });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
