import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";
import { requireFeature } from "@/lib/plan/requireFeature";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { Column, drawTable } from "@/lib/pdf/table";

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
    if (!escolaId) return NextResponse.json({ ok: true, turma: null, total: 0, alunos: [] }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";
    const isAttendance = searchParams.get("attendance") === "true";

    if (format === "pdf") {
      await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });
      const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/${turmaId}/alunos/pdf${isAttendance ? '?attendance=true' : ''}`);
      if (forwarded) return forwarded;
    }

    // 1) Carregar turma + escola (RLS garante escola correta)
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
      supabase
        .from("escolas")
        .select("id, nome, nif, numero_fiscal, endereco, morada, telefone, email, logo_url, logo, validation_base_url, responsavel, diretor_nome, diretor_cargo")
        .eq("id", escolaId)
        .maybeSingle(),
      turma.classe_id
        ? supabase
            .from("classes")
            .select("nome")
            .eq("id", turma.classe_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const classeNome = (classe as any)?.nome || "—";

    // 2) Buscar matrículas ativas + dados dos alunos
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
        genero: (a.sexo === 'masculino' || a.sexo === 'M') ? 'M' : (a.sexo === 'feminino' || a.sexo === 'F') ? 'F' : '—',
        bi: a.bi_numero ?? "—",
        naturalidade: a.naturalidade ?? "—",
        provincia: a.provincia ?? "—",
        telefone: a.telefone ?? "—",
        encarregado: a.responsavel ?? "—",
        telefone_encarregado: a.telefone_responsavel ?? "—",
        status_matricula: (m as any)?.status,
      }));
    });

    // 3) Resposta JSON (default)
    if (format !== "pdf") {
      return NextResponse.json({
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
      }, { headers });
    }

    // 4) Geração de PDF institucional com QR
    const verificationToken = randomUUID();
    const validationBase =
      process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? escola?.validation_base_url ?? undefined;

    const pdfBytes = (await createInstitutionalPdf({
      title: isAttendance ? "Folha de Presença / Pauta de Chamada" : "Lista de Alunos por Turma",
      orientation: isAttendance ? "landscape" : "portrait",
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
        width,
        margin,
        contentStartY,
        font,
        boldFont,
        verificationUrl,
      }) => {
        let cursorY = contentStartY;
        const lineHeight = 14;

        page.drawText(
          `Turma: ${turma.nome ?? "—"}  •  Classe: ${classeNome}  •  Turno: ${turma.turno ?? "—"}`,
          { x: margin, y: cursorY, font: boldFont, size: 10 }
        );
        cursorY -= lineHeight;
        
        if (turma.sala) {
          page.drawText(`Sala: ${turma.sala}`, { x: margin, y: cursorY, font, size: 10 });
          cursorY -= lineHeight;
        }

        cursorY -= 4;

        const columns: Column[] = isAttendance 
          ? [
              { header: "Nº", key: "numero", width: 25, align: "center" },
              { header: "Nome do Aluno", key: "nome", width: 220 },
              { header: "G", key: "genero", width: 20, align: "center" },
              { header: "", key: "d1", width: 45 },
              { header: "", key: "d2", width: 45 },
              { header: "", key: "d3", width: 45 },
              { header: "", key: "d4", width: 45 },
              { header: "", key: "d5", width: 45 },
              { header: "", key: "d6", width: 45 },
              { header: "", key: "d7", width: 45 },
              { header: "", key: "d8", width: 45 },
              { header: "", key: "d9", width: 45 },
              { header: "Assinatura / Obs", key: "obs", width: 80 },
            ]
          : [
              { header: "Nº", key: "numero", width: 30, align: "center" },
              { header: "Nome do Aluno", key: "nome", width: 230 },
              { header: "G", key: "genero", width: 20, align: "center" },
              { header: "Documento (BI)", key: "bi", width: 100 },
              { header: "Encarregado", key: "encarregado", width: 125 },
            ];

        const { lastPage, lastY } = await drawTable(columns, alunosOrdenados, {
          page,
          pdfDoc,
          font,
          boldFont,
          margin,
          startY: cursorY,
          zebra: true,
          rowHeight: 18,
        });

        cursorY = lastY - 20;

        // QR code + assinatura no rodapé da área útil
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

          const sigY = qrY + qrSize + 5;
          lastPage.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo,
            }),
            {
              x: margin,
              y: sigY,
              font,
              size: 10,
            }
          );
        } else {
          const sigY = cursorY - 10;
          lastPage.drawText(
            buildSignatureLine({
              signerName: escola?.responsavel ?? escola?.diretor_nome,
              signerRole: escola?.diretor_cargo,
            }),
            {
              x: margin,
              y: sigY,
              font,
              size: 10,
            }
          );
        }
      },
    })) as Uint8Array;

    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lista_alunos_turma_${
          turma.nome ?? turma.id
        }${isAttendance ? '_presenca' : ''}.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
