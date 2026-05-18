import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireFeature } from "@/lib/plan/requireFeature";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf";

type TurmaRow = {
  id: string;
  nome: string | null;
  classe_id?: string | null;
  escola_id?: string | null;
  turno?: string | null;
  sala?: string | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: turmaId } = await params;
    const { data: turmaScope } = await supabase
      .from("turmas")
      .select("escola_id")
      .eq("id", turmaId)
      .maybeSingle();

    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      (turmaScope as any)?.escola_id ?? null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: true, turma: null, total: 0, alunos: [] }, { headers });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    headers.set("Deprecation", "true");
    headers.set("Link", `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";
    const isAttendance = searchParams.get("attendance") === "true";
    const month = searchParams.get("month");
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const disciplinaId = searchParams.get("disciplina_id");
    const isAlbum = searchParams.get("album") === "true";
    const includeAllStatus = searchParams.get("all_status") === "true";
    const fallbackLogoUrl = `${new URL(req.url).origin}/insignia_med.png`;

    if (format === "pdf") {
      await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });

      const pdfBytes = await renderListaNominalPdfBuffer({
        supabase: supabase as any,
        escolaId,
        turmaId,
        month,
        year,
        isAttendance,
        disciplinaId,
        isAlbum,
        includeAllStatus,
        fallbackLogoUrl,
      });

      headers.set("Content-Type", "application/pdf");
      headers.set(
        "Content-Disposition",
        `attachment; filename="mapa_frequencia_${turmaId}_${month || "lista"}.pdf"`
      );
      return new NextResponse(pdfBytes as any, { headers });
    }

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select(
        `
        id,
        nome,
        escola_id,
        classe_id,
        turno,
        sala
      `
      )
      .eq("id", turmaId)
      .eq("escola_id", escolaId)
      .single<TurmaRow>();

    if (turmaError || !turma) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada" }, { status: 404, headers });
    }

    const [{ data: escola }, { data: classe }] = await Promise.all([
      supabase.from("escolas").select("id, nome").eq("id", escolaId).maybeSingle(),
      turma.classe_id
        ? supabase.from("classes").select("nome").eq("id", turma.classe_id).eq("escola_id", escolaId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const classeNome = (classe as any)?.nome || "—";

    let matriculasQuery = supabase
      .from("matriculas")
      .select(
        `
        id,
        numero_chamada,
        status,
        alunos (
          id,
          nome,
          bi_numero,
          sexo,
          naturalidade,
          provincia,
          telefone,
          responsavel,
          telefone_responsavel
        )
      `
      )
      .eq("turma_id", turmaId)
      .eq("escola_id", escolaId)
      .in("status", ["ativo", "ativa"])
      .order("numero_chamada", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 50 });

    const { data: matriculas, error: matriculasError } = await matriculasQuery;
    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 500, headers });
    }

    let numero = 1;
    const alunosOrdenados = (matriculas ?? []).flatMap((m) => {
      const alunoData = (m as any)?.alunos;
      const alunosArray = Array.isArray(alunoData) ? alunoData : alunoData ? [alunoData] : [];

      return alunosArray.map((a) => ({
        numero: m.numero_chamada ?? numero++,
        matricula_id: (m as any)?.id,
        aluno_id: a.id,
        nome: a.nome ?? "—",
        genero: a.sexo === "masculino" || a.sexo === "M" ? "M" : a.sexo === "feminino" || a.sexo === "F" ? "F" : "—",
        bi: a.bi_numero ?? "—",
        naturalidade: a.naturalidade ?? "—",
        provincia: a.provincia ?? "—",
        telefone: a.telefone ?? "—",
        encarregado: a.responsavel ?? "—",
        telefone_encarregado: a.telefone_responsavel ?? "—",
        status_matricula: (m as any)?.status,
      }));
    });

    return NextResponse.json(
      {
        ok: true,
        turma: {
          id: turma.id,
          nome: turma.nome,
          codigo: null,
          classe: classeNome,
          turno: turma.turno ?? null,
          sala: turma.sala ?? null,
          escola_nome: escola?.nome ?? null,
        },
        total: alunosOrdenados.length,
        alunos: alunosOrdenados,
      },
      { headers }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
