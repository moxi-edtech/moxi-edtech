import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { Database } from "~types/supabase";
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { drawTable, type Column } from "@/lib/pdf/table";

type Client = SupabaseClient<Database>;

type TurmaRow = {
  id: string;
  nome: string | null;
  escola_id: string;
  curso_id: string | null;
  session_id: string | null;
  ano_letivo: number | null;
  classe_id: string | null;
  turno: string | null;
  sala: string | null;
};

type EscolaRow = {
  id: string;
  nome: string | null;
  nif: string | null;
  numero_fiscal: string | null;
  endereco: string | null;
  morada: string | null;
  telefone: string | null;
  email: string | null;
  logo_url: string | null;
  logo: string | null;
  validation_base_url: string | null;
  responsavel: string | null;
  diretor_nome: string | null;
  diretor_cargo: string | null;
};

type ClasseRow = { nome: string | null };
type SessaoRow = { ano: number | null };

type AlunoNested = {
  id: string;
  nome: string | null;
  bi_numero: string | null;
  genero?: string | null;
  data_nascimento?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
};

type MatriculaRow = {
  id: string;
  numero_chamada: number | null;
  alunos: AlunoNested | AlunoNested[] | null;
};

type FrequenciaRow = {
  matricula_id: string;
  data: string;
  status: string;
};

type ListaNominalPdfParams = {
  supabase: Client;
  escolaId: string;
  turmaId: string;
  month?: string | null;
  year?: string | null;
  isAttendance?: boolean;
  disciplinaId?: string | null;
};

function mapStatus(status: string) {
  if (status === "presente") return "P";
  if (status === "falta") return "F";
  if (status === "atraso") return "A";
  return "—";
}

export async function renderListaNominalPdfBuffer({
  supabase,
  escolaId,
  turmaId,
  month,
  year,
  isAttendance = false,
  disciplinaId,
}: ListaNominalPdfParams) {
  const normalizedYear = year || String(new Date().getFullYear());

  const { data: turmaData, error: turmaError } = await supabase
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

  if (turmaError || !turmaData) {
    throw new Error("Turma não encontrada");
  }

  const turma = turmaData as unknown as TurmaRow;

  const [escolaRes, classeRes, sessaoRes] = await Promise.all([
    supabase
      .from("escolas")
      .select("id, nome, nif, numero_fiscal, endereco, morada, telefone, email, logo_url, logo, validation_base_url, responsavel, diretor_nome, diretor_cargo")
      .eq("id", escolaId)
      .maybeSingle(),
    turma.classe_id
      ? supabase.from("classes").select("nome").eq("id", turma.classe_id).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    turma.session_id
      ? supabase.from("anos_letivos").select("ano").eq("id", turma.session_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (escolaRes.error) throw new Error(escolaRes.error.message);
  if (classeRes.error) throw new Error(classeRes.error.message);
  if (sessaoRes.error) throw new Error(sessaoRes.error.message);

  const escola = escolaRes.data as unknown as EscolaRow | null;
  const classe = classeRes.data as unknown as ClasseRow | null;
  const sessao = sessaoRes.data as unknown as SessaoRow | null;
  const classeNome = classe?.nome ?? "—";

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

  const { data: matriculasData, error: matriculasError } = await matriculasQuery;
  if (matriculasError) throw new Error(matriculasError.message);

  let attendanceData: FrequenciaRow[] = [];
  if (month && normalizedYear) {
    const startDate = `${normalizedYear}-${month.padStart(2, "0")}-01`;
    const lastDay = new Date(parseInt(normalizedYear, 10), parseInt(month, 10), 0).getDate();
    const endDate = `${normalizedYear}-${month.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let query = supabase
      .from("frequencias")
      .select("matricula_id, data, status")
      .eq("escola_id", escolaId)
      .gte("data", startDate)
      .lte("data", endDate);

    if (disciplinaId && turma.curso_id && turma.classe_id) {
      const { data: matriz } = await supabase
        .from("curso_matriz")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("curso_id", turma.curso_id)
        .eq("classe_id", turma.classe_id)
        .eq("disciplina_id", disciplinaId)
        .maybeSingle();

      if (matriz?.id) {
        query = query.eq("curso_matriz_id", matriz.id);
      }
    }

    const { data: frequenciasData, error: frequenciasError } = await query;
    if (frequenciasError) throw new Error(frequenciasError.message);
    attendanceData = (frequenciasData ?? []) as unknown as FrequenciaRow[];
  }

  const matriculas = (matriculasData ?? []) as unknown as MatriculaRow[];
  const alunos = matriculas.map((matricula, index) => {
    const aluno = Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos;
    const row: Record<string, string | number> = {
      id: matricula.id,
      numero: matricula.numero_chamada ?? index + 1,
      nome: aluno?.nome ?? "—",
      genero:
        aluno?.genero === "masculino" || aluno?.genero === "M"
          ? "M"
          : aluno?.genero === "feminino" || aluno?.genero === "F"
            ? "F"
            : "—",
      bi: aluno?.bi_numero ?? "—",
      telefone: aluno?.telefone ?? "—",
      responsavel: aluno?.responsavel ?? "—",
      telefone_responsavel: aluno?.telefone_responsavel ?? "—",
    };

    if (month && normalizedYear) {
      const studentAttendance = attendanceData.filter((item) => item.matricula_id === matricula.id);
      for (let day = 1; day <= 31; day += 1) {
        const dateStr = `${normalizedYear}-${month.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const record = studentAttendance.find((item) => item.data === dateStr);
        row[`d${day}`] = record ? mapStatus(record.status) : "";
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
    title: month
      ? "Mapa de Frequência Mensal"
      : isAttendance
        ? "Folha de Presença / Pauta de Chamada"
        : "Lista de Alunos por Turma",
    orientation: isAttendance || month ? "landscape" : "portrait",
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
      const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const periodLabel = month ? `  •  Mês: ${monthNames[parseInt(month, 10) - 1]} / ${normalizedYear}` : "";

      page.drawText(
        `Turma: ${turma.nome ?? "—"}  •  Classe: ${classeNome}  •  Turno: ${turma.turno ?? "—"}${periodLabel}`,
        { x: margin, y: cursorY, font: boldFont, size: 10 }
      );
      cursorY -= lineHeight;
      page.drawText(
        `Ano letivo: ${sessao?.ano ?? turma.ano_letivo ?? "—"}  •  Sala: ${turma.sala ?? "—"}`,
        { x: margin, y: cursorY, font, size: 10 }
      );
      cursorY -= lineHeight * 1.5;

      let columns: Column[] = [];
      if (month) {
        columns = [
          { header: "Nº", key: "numero", width: 22, align: "center" },
          { header: "Nome do Aluno", key: "nome", width: 140 },
        ];
        for (let day = 1; day <= 31; day += 1) {
          columns.push({ header: String(day), key: `d${day}`, width: 17.5, align: "center" });
        }
      } else if (isAttendance) {
        columns = [
          { header: "Nº", key: "numero", width: 25, align: "center" },
          { header: "Nome do Aluno", key: "nome", width: 220 },
          { header: "G", key: "genero", width: 20, align: "center" },
          ...Array.from({ length: 9 }).map((_, index) => ({ header: "", key: `d${index + 1}`, width: 45 })),
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

      if (month) {
        lastPage.drawText("Legenda: P = Presente | F = Falta | A = Atraso | FJ = Falta Justificada", {
          x: margin,
          y: cursorY + 5,
          font,
          size: 8,
        });
        cursorY -= 15;
      }

      const qrSize = 70;
      const signatureText = buildSignatureLine({
        signerName: escola?.responsavel ?? escola?.diretor_nome,
        signerRole: escola?.diretor_cargo ?? "Diretor(a)",
      });

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
        lastPage.drawText(signatureText, {
          x: margin,
          y: qrY + qrSize + 5,
          font,
          size: 10,
        });
      } else {
        lastPage.drawText(signatureText, {
          x: margin,
          y: cursorY - 10,
          font,
          size: 10,
        });
      }
    },
  });

  return Buffer.from(pdfBytes);
}
