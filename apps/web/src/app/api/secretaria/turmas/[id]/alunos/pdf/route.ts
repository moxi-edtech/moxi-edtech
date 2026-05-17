import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { createQrImage, buildSignatureLine } from "@/lib/pdf/qr";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";
import { requireFeature } from "@/lib/plan/requireFeature";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { Column, drawTable } from "@/lib/pdf/table";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
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
      return NextResponse.json(
        { ok: false, error: "Escola não encontrada" },
        { status: 400 }
      );
    }

    await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const isAttendance = searchParams.get("attendance") === "true";
    const month = searchParams.get("month");
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const disciplinaId = searchParams.get("disciplina_id");

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/${turmaId}/alunos/pdf${isAttendance ? '?attendance=true' : ''}${month ? `&month=${month}` : ''}${year ? `&year=${year}` : ''}`);
    if (forwarded) return forwarded;

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select(
        `
        id,
        nome,
        escola_id,
        curso_id,
        session_id,
        ano_letivo,
        classe_id,
        turno,
        sala
      `
      )
      .eq("id", turmaId)
      .eq("escola_id", escolaId)
      .single();

    if (turmaError || !turma) {
      return NextResponse.json(
        { ok: false, error: "Turma não encontrada" },
        { status: 404, headers }
      );
    }
    const [{ data: escola }, { data: classe }, { data: sessao }] = await Promise.all([
      supabase
        .from("escolas")
        .select("id, nome, nif, numero_fiscal, endereco, morada, telefone, email, logo_url, logo, validation_base_url, responsavel, diretor_nome, diretor_cargo")
        .eq("id", escolaId)
        .maybeSingle(),
      (turma as any)?.classe_id
        ? supabase
            .from("classes")
            .select("nome")
            .eq("id", (turma as any).classe_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      (turma as any)?.session_id
        ? supabase
            .from("school_sessions")
            .select("nome, ano")
            .eq("id", (turma as any).session_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const classeNome = (classe as any)?.nome ?? "—";

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
          genero,
          data_nascimento,
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

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 1000 });

    const { data: matriculas, error: alunosError } = await matriculasQuery;

    if (alunosError) {
      return NextResponse.json(
        { ok: false, error: alunosError.message },
        { status: 500, headers }
      );
    }

    // --- PHASE 2: Fetch actual attendance data ---
    let attendanceData: any[] = [];
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      // Last day of month
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
      
      let query = supabase
        .from("frequencias")
        .select("matricula_id, data, status")
        .eq("escola_id", escolaId)
        .gte("data", startDate)
        .lte("data", endDate);
      
      if (disciplinaId) {
        const { data: matriz } = await supabase
          .from("curso_matriz")
          .select("id")
          .eq("escola_id", escolaId)
          .eq("curso_id", turma.curso_id)
          .eq("classe_id", turma.classe_id)
          .eq("disciplina_id", disciplinaId)
          .maybeSingle();
        
        if (matriz) {
          query = query.eq("curso_matriz_id", matriz.id);
        }
      }

      const { data: fRecords } = await query;
      attendanceData = fRecords || [];
    }

    const mapStatus = (status: string) => {
      if (status === 'presente') return 'P';
      if (status === 'falta') return 'F';
      if (status === 'atraso') return 'A';
      return '—';
    };

    const alunos = (matriculas ?? []).map((mat, index) => {
      const aluno = Array.isArray(mat.alunos) ? mat.alunos[0] : mat.alunos;
      const row: any = {
        id: mat.id,
        numero: mat.numero_chamada ?? index + 1,
        nome: aluno?.nome ?? "—",
        genero: (aluno?.genero === 'masculino' || aluno?.genero === 'M') ? 'M' : (aluno?.genero === 'feminino' || aluno?.genero === 'F') ? 'F' : '—',
        bi: aluno?.bi_numero ?? "—",
        telefone: aluno?.telefone ?? "—",
        responsavel: aluno?.responsavel ?? "—",
        telefone_responsavel: aluno?.telefone_responsavel ?? "—",
      };

      if (month && year) {
        const studentAttendance = attendanceData.filter(a => a.matricula_id === mat.id);
        for (let d = 1; d <= 31; d++) {
          const dateStr = `${year}-${month.padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const record = studentAttendance.find(a => a.data === dateStr);
          if (record) {
            row[`d${d}`] = mapStatus(record.status);
          } else {
            row[`d${d}`] = '';
          }
        }
      }

      return row;
    });

    const verificationToken = randomUUID();
    const validationBase =
      process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
      escola?.validation_base_url ??
      undefined;

    const pdfBytes = await createInstitutionalPdf({
      title: (month) ? "Mapa de Frequência Mensal" : (isAttendance ? "Folha de Presença / Pauta de Chamada" : "Lista de Alunos por Turma"),
      orientation: (isAttendance || month) ? "landscape" : "portrait",
      school: {
        name: escola?.nome ?? "Escola",
        nif: escola?.nif ?? escola?.numero_fiscal,
        address: escola?.endereco ?? escola?.morada,
        contacts: [escola?.telefone, escola?.email].filter(Boolean).join(" • "),
        logoUrl: escola?.logo_url ?? escola?.logo,
        validationBaseUrl: validationBase,
      },
      verificationToken,
      content: async ({
        page,
        pdfDoc,
        margin,
        contentStartY,
        font,
        boldFont,
        verificationUrl,
        width,
      }) => {
        let cursorY = contentStartY;
        const lineHeight = 14;

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const periodLabel = month ? `  •  Mês: ${monthNames[parseInt(month)-1]} / ${year}` : "";

        page.drawText(
          `Turma: ${turma.nome ?? "—"}  •  Classe: ${classeNome}  •  Turno: ${turma.turno ?? "—"}${periodLabel}`,
          { x: margin, y: cursorY, font: boldFont, size: 10 }
        );
        cursorY -= lineHeight;
        page.drawText(
          `Ano letivo: ${sessao?.nome ?? sessao?.ano ?? (turma as any)?.ano_letivo ?? "—"}  •  Sala: ${turma.sala ?? "—"}`,
          { x: margin, y: cursorY, font, size: 10 }
        );
        cursorY -= lineHeight * 1.5;

        let columns: Column[] = [];
        
        if (month) {
          columns = [
            { header: "Nº", key: "numero", width: 22, align: "center" },
            { header: "Nome do Aluno", key: "nome", width: 140 },
          ];
          for (let d = 1; d <= 31; d++) {
            columns.push({ header: String(d), key: `d${d}`, width: 17.5, align: "center" });
          }
        } else if (isAttendance) {
          columns = [
            { header: "Nº", key: "numero", width: 25, align: "center" },
            { header: "Nome do Aluno", key: "nome", width: 220 },
            { header: "G", key: "genero", width: 20, align: "center" },
            ...Array.from({ length: 9 }).map((_, i) => ({ header: "", key: `d${i+1}`, width: 45 })),
            { header: "Assinatura / Obs", key: "obs", width: 80 },
          ];
        } else {
          columns = [
            { header: "Nº", key: "numero", width: 30, align: "center" },
            { header: "Nome do Aluno", key: "nome", width: 230 },
            { header: "G", key: "genero", width: 20, align: "center" },
            { header: "Documento (BI)", key: "bi", width: 100 },
            { header: "Encarregado", key: "responsavel", width: 125 },
          ];
        }

        const { lastPage, lastY } = await drawTable(columns, alunos, {
          page,
          pdfDoc,
          font,
          boldFont,
          margin,
          startY: cursorY,
          zebra: true,
          rowHeight: 18,
          fontSize: month ? 7 : 9,
          headerFontSize: month ? 7 : 10,
        });

        cursorY = lastY - 20;

        // Legends if it's a monthly map
        if (month) {
          lastPage.drawText("Legenda: P = Presente | F = Falta | A = Atraso | FJ = Falta Justificada", {
            x: margin,
            y: cursorY + 5,
            font,
            size: 8,
          });
          cursorY -= 15;
        }

        // Signature and QR Code
        const qrSize = 70;
        if (verificationUrl) {
          const qrImage = await createQrImage(pdfDoc, verificationUrl);
          const qrX = width - margin - qrSize;
          const qrY = Math.max(cursorY - qrSize - 10, margin + 40);
          lastPage.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
          });

          const signatureY = qrY + qrSize + 5;
          lastPage.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo ?? "Diretor(a)",
            }),
            {
              x: margin,
              y: signatureY,
              font,
              size: 10,
            }
          );
        } else {
          const signatureY = cursorY - 10;
          lastPage.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo ?? "Diretor(a)",
            }),
            {
              x: margin,
              y: signatureY,
              font,
              size: 10,
            }
          );
        }
      },
    });

    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="mapa_frequencia_${turma.nome ?? "turma"}_${month || 'lista'}.pdf"`
    );
    return new NextResponse(pdfBytes as any, {
      headers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[secretaria/turmas/pdf] error:", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
