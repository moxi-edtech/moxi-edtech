import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireFeature } from "@/lib/plan/requireFeature";
import { loadNominalRoster, NominalRosterError } from "@/lib/documentos/listaNominalService";
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf";
import { canExportSensitiveRosterFields } from "@/lib/documentos/rosterSensitivePermission";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");
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
    const modeParam = searchParams.get("mode");
    if (modeParam && modeParam !== "ano_letivo" && modeParam !== "operacional") {
      return NextResponse.json({ ok: false, error: "Modo de lista inválido" }, { status: 400 });
    }
    const mode = modeParam === "ano_letivo" || modeParam === "operacional" ? modeParam : undefined;
    const camposSensiveis = searchParams.get("sensiveis") === "true";
    if (camposSensiveis) {
      const authorised = await canExportSensitiveRosterFields(supabase, escolaId, user.id);
      if (!authorised) {
        return NextResponse.json({ ok: false, error: "Campos sensíveis reservados à Direcção" }, { status: 403 });
      }
    }
    const fallbackLogoUrl = `${new URL(req.url).origin}/insignia_med.png`;

    if (format === "pdf") {
      const enableQr = searchParams.get("qr") === "true";
      if (enableQr || isAlbum || isAttendance || month) await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });

      let linhasExportadas = 0;
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
        mode,
        enableQr,
        camposSensiveis,
        emissor: user.email ?? user.id,
        onRowsCount: (count) => { linhasExportadas = count; },
        fallbackLogoUrl,
      });

      if (!month && !isAttendance && !isAlbum) {
        const { error: auditError } = await supabase.from("audit_logs").insert({
          escola_id: escolaId, portal: "secretaria", acao: "LISTA_NOMINAL_PDF_EXPORTADA",
          tabela: "turmas", entity: "turmas", entity_id: turmaId,
          details: {
            actor_id: user.id, turma_id: turmaId,
            modo: mode ?? "conforme_sessao", ano: year,
            linhas: linhasExportadas,
            campos_sensiveis: camposSensiveis,
            campos: camposSensiveis ? ["nascimento", "naturalidade", "bi"] : [],
          },
        });
        if (auditError) {
          return NextResponse.json({ ok: false, error: "Auditoria indisponível. Lista não emitida." }, { status: 503 });
        }
      }

      headers.set("Content-Type", "application/pdf");
      headers.set(
        "Content-Disposition",
        `attachment; filename="lista_escola_${escolaId}_turma_${turmaId}_${year}_${new Date().toISOString().slice(0,10)}.pdf"`
      );
      return new NextResponse(pdfBytes as any, { headers });
    }

    // A lista JSON partilha a mesma leitura paginada e política dos documentos PDF/XLSX.
    // Não omitir alunos depois da posição 50 nem consultar outra fonte.
    const roster = await loadNominalRoster({
      supabase: supabase as any,
      escolaId,
      turmaId,
      mode,
      includeAllStatus,
      jsonFields: true,
      extendedStudentFields: camposSensiveis,
    });

    let numero = 1;
    const alunosOrdenados = roster.sortedMatriculas.flatMap((m) => {
      const alunoData = (m as any)?.alunos;
      const alunosArray = Array.isArray(alunoData) ? alunoData : alunoData ? [alunoData] : [];

      return alunosArray.map((a) => ({
        numero: m.numero_chamada ?? numero++,
        matricula_id: (m as any)?.id,
        aluno_id: a.id,
        nome: a.nome ?? "—",
        genero: a.sexo === "masculino" || a.sexo === "M" ? "M" : a.sexo === "feminino" || a.sexo === "F" ? "F" : "—",
        processo: a.numero_processo ?? "NÃO ATRIBUÍDO",
        ...(camposSensiveis ? { bi: a.bi_numero ?? "—" } : {}),
        ...(camposSensiveis ? {
          naturalidade: a.naturalidade ?? "—",
          provincia: a.provincia ?? "—",
          telefone: a.telefone ?? "—",
          encarregado: a.responsavel ?? "—",
          telefone_encarregado: a.telefone_responsavel ?? "—",
        } : {}),
        status_matricula: (m as any)?.status,
      }));
    });

    return NextResponse.json(
      {
        ok: true,
        turma: {
          id: roster.turma.id,
          nome: roster.turma.nome,
          codigo: null,
          classe: roster.classeNome,
          turno: roster.turma.turno ?? null,
          sala: roster.turma.sala ?? null,
          escola_nome: roster.escola.nome ?? null,
        },
        total: alunosOrdenados.length,
        alunos: alunosOrdenados,
      },
      { headers }
    );
  } catch (error) {
    if (error instanceof NominalRosterError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível consultar a lista" }, { status: 500 });
  }
}
