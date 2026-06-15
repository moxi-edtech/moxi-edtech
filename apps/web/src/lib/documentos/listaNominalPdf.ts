import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { rgb } from "pdf-lib";
import type { Database } from "~types/supabase";
import { createInstitutionalPdf, detectImageFormat, fetchImageBytes } from "@/lib/pdf/documentTemplate";
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
  endereco: string | null;
  logo_url: string | null;
};

type ClasseRow = { nome: string | null };
type SessaoRow = { ano: number | null };

type AlunoNested = {
  id: string;
  nome: string | null;
  bi_numero: string | null;
  sexo?: string | null;
  data_nascimento?: string | null;
  naturalidade?: string | null;
  provincia?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  profiles?: { avatar_url?: string | null } | null;
};

type MatriculaRow = {
  id: string;
  turma_id: string | null;
  numero_chamada: number | null;
  status: string;
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
  turmaId?: string | null;
  classeId?: string | null;
  month?: string | null;
  year?: string | null;
  isAttendance?: boolean;
  disciplinaId?: string | null;
  isAlbum?: boolean;
  includeAllStatus?: boolean;
  fallbackLogoUrl?: string | null;
};

function mapStatus(status: string) {
  if (status === "presente") return "P";
  if (status === "falta") return "F";
  if (status === "atraso") return "A";
  if (status === "falta_justificada" || status === "justificada") return "FJ";
  return "—";
}

function calculateAge(birthDate: string | null | undefined) {
  if (!birthDate) return "—";
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return "—";
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return "—";
  }
}

function fitMetaLines(parts: string[], maxWidth: number, font: any, size: number) {
  const lines: string[] = [];
  let current = "";

  for (const part of parts.filter(Boolean)) {
    const candidate = current ? `${current}  •  ${part}` : part;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = part;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function getLogoBaseUrl(fallbackLogoUrl?: string | null) {
  if (fallbackLogoUrl) {
    try {
      return new URL(fallbackLogoUrl).origin;
    } catch {
      // Ignore invalid fallback URLs and use environment fallbacks below.
    }
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return null;
}

function normalizePdfLogoUrl(value: string | null | undefined, fallbackLogoUrl?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === "/insignia_med.png" || lower.endsWith("/insignia_med.png")) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    const baseUrl = getLogoBaseUrl(fallbackLogoUrl);
    if (!baseUrl) return trimmed;
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }
}

export async function renderListaNominalPdfBuffer({
  supabase,
  escolaId,
  turmaId,
  classeId,
  month,
  year,
  isAttendance = false,
  disciplinaId,
  isAlbum = false,
  includeAllStatus = false,
  fallbackLogoUrl,
}: ListaNominalPdfParams) {
  const normalizedYear = year || String(new Date().getFullYear());
  const isClasseScope = Boolean(classeId && !turmaId);

  if (!turmaId && !classeId) {
    throw new Error("Informe turma ou classe para gerar a lista nominal");
  }

  let turma: TurmaRow;
  let classeNome = "—";
  let cursoNome = "";
  let turmaIds: string[] = [];
  let turmaById = new Map<string, TurmaRow>();

  if (isClasseScope && classeId) {
    const { data: classeData, error: classeError } = await supabase
      .from("classes")
      .select("id, nome, curso_id, cursos(nome)")
      .eq("id", classeId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (classeError) throw new Error(classeError.message);
    if (!classeData) throw new Error("Classe não encontrada");

    classeNome = (classeData as any)?.nome ?? "—";
    cursoNome = (classeData as any)?.cursos?.nome ?? "";

    let turmasQuery = supabase
      .from("turmas")
      .select("id, nome, escola_id, curso_id, session_id, ano_letivo, classe_id, turno, sala")
      .eq("escola_id", escolaId)
      .eq("classe_id", classeId)
      .order("turno", { ascending: true })
      .order("nome", { ascending: true });

    if (normalizedYear) {
      const yearNumber = Number(normalizedYear);
      if (Number.isFinite(yearNumber)) {
        turmasQuery = turmasQuery.eq("ano_letivo", yearNumber);
      }
    }

    const { data: turmasData, error: turmasError } = await turmasQuery;
    if (turmasError) throw new Error(turmasError.message);

    const turmasClasse = (turmasData ?? []) as unknown as TurmaRow[];
    turmaIds = turmasClasse.map((item) => item.id).filter(Boolean);
    turmaById = new Map(turmasClasse.map((item) => [item.id, item]));

    if (turmaIds.length === 0) {
      throw new Error("Não há turmas para esta classe no ano letivo selecionado");
    }

    turma = {
      id: `classe:${classeId}`,
      nome: `Todas as turmas (${turmaIds.length})`,
      escola_id: escolaId,
      curso_id: (classeData as any)?.curso_id ?? turmasClasse[0]?.curso_id ?? null,
      session_id: turmasClasse[0]?.session_id ?? null,
      ano_letivo: Number(normalizedYear) || (turmasClasse[0]?.ano_letivo ?? null),
      classe_id: classeId,
      turno: null,
      sala: null,
    };
  } else if (turmaId) {
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

    turma = turmaData as unknown as TurmaRow;
    turmaIds = [turma.id];
    turmaById = new Map([[turma.id, turma]]);
  } else {
    throw new Error("Escopo inválido para lista nominal");
  }

  const [escolaRes, classeRes, sessaoRes, extraDataRes] = await Promise.all([
    supabase
      .from("escolas")
      .select("id, nome, nif, endereco, logo_url")
      .eq("id", escolaId)
      .maybeSingle(),
    !isClasseScope && turma.classe_id
      ? supabase.from("classes").select("nome").eq("id", turma.classe_id).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    turma.session_id
      ? supabase.from("anos_letivos").select("ano").eq("id", turma.session_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    disciplinaId && turmaId
      ? Promise.all([
          supabase.from("disciplinas_catalogo").select("nome").eq("id", disciplinaId).maybeSingle(),
          supabase
            .from("turma_disciplinas_professores")
            .select("professores(profiles(nome))")
            .eq("turma_id", turmaId)
            .eq("disciplina_id", disciplinaId)
            .maybeSingle()
        ])
      : Promise.resolve([null, null])
  ]);

  if (escolaRes.error) throw new Error(escolaRes.error.message);
  if (classeRes.error) throw new Error(classeRes.error.message);
  if (sessaoRes.error) throw new Error(sessaoRes.error.message);

  const escola = escolaRes.data as unknown as EscolaRow | null;
  const classe = classeRes.data as unknown as ClasseRow | null;
  const sessao = sessaoRes.data as unknown as SessaoRow | null;
  if (!isClasseScope) {
    classeNome = classe?.nome ?? "—";
  }

  const disciplinaNome = (extraDataRes?.[0] as any)?.data?.nome || "";
  const professorNome = (extraDataRes?.[1] as any)?.data?.professores?.profiles?.nome || "";

  let matriculasQuery = supabase
    .from("matriculas")
    .select(
      `
      id,
      turma_id,
      numero_chamada,
      status,
      alunos (
        id,
        nome,
        bi_numero,
        sexo,
        data_nascimento,
        naturalidade,
        provincia,
        telefone,
        responsavel,
        telefone_responsavel,
        profiles!alunos_profile_id_fkey (
          avatar_url
        )
      )
    `
    )
    .eq("escola_id", escolaId)
    .order("numero_chamada", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (isClasseScope) {
    matriculasQuery = matriculasQuery.in("turma_id", turmaIds);
  } else if (turmaId) {
    matriculasQuery = matriculasQuery.eq("turma_id", turmaId);
  }

  if (!includeAllStatus) {
    matriculasQuery = matriculasQuery.in("status", ["ativo", "ativa"]);
  }

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
  const sortedMatriculas = isClasseScope
    ? [...matriculas].sort((a, b) => {
        const turmaA = turmaById.get(a.turma_id ?? "")?.nome ?? "";
        const turmaB = turmaById.get(b.turma_id ?? "")?.nome ?? "";
        const byTurma = turmaA.localeCompare(turmaB, "pt-PT");
        if (byTurma !== 0) return byTurma;
        const byNumero = (a.numero_chamada ?? 9999) - (b.numero_chamada ?? 9999);
        if (byNumero !== 0) return byNumero;
        const alunoA = Array.isArray(a.alunos) ? a.alunos[0] : a.alunos;
        const alunoB = Array.isArray(b.alunos) ? b.alunos[0] : b.alunos;
        return String(alunoA?.nome ?? "").localeCompare(String(alunoB?.nome ?? ""), "pt-PT");
      })
    : matriculas;

  const alunos = sortedMatriculas.map((matricula, index) => {
    const aluno = Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos;
    const turmaAluno = turmaById.get(matricula.turma_id ?? "");
    const row: Record<string, string | number> = {
      id: matricula.id,
      numero: matricula.numero_chamada ?? index + 1,
      turma: turmaAluno?.nome ?? "—",
      nome: aluno?.nome ?? "—",
      genero:
        aluno?.sexo === "masculino" || aluno?.sexo === "M"
          ? "M"
          : aluno?.sexo === "feminino" || aluno?.sexo === "F"
            ? "F"
            : "—",
      bi: aluno?.bi_numero ?? "—",
      data_nascimento: aluno?.data_nascimento ?? "—",
      idade: calculateAge(aluno?.data_nascimento),
      naturalidade: aluno?.naturalidade ?? "—",
      provincia: aluno?.provincia ?? "—",
      telefone: aluno?.telefone ?? "—",
      responsavel: aluno?.responsavel ?? "—",
      telefone_responsavel: aluno?.telefone_responsavel ?? "—",
      status: matricula.status,
    };

    if (aluno?.profiles?.avatar_url) {
      row.foto_url = aluno.profiles.avatar_url;
    }

    if (month && normalizedYear) {
      const studentAttendance = attendanceData.filter((item) => item.matricula_id === matricula.id);
      let totalP = 0;
      let totalF = 0;
      let totalA = 0;
      let totalFJ = 0;

      for (let day = 1; day <= 31; day += 1) {
        const dateStr = `${normalizedYear}-${month.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const record = studentAttendance.find((item) => item.data === dateStr);
        const status = record ? mapStatus(record.status) : "";
        row[`d${day}`] = status;

        if (status === "P") totalP++;
        else if (status === "F") totalF++;
        else if (status === "A") totalA++;
        else if (status === "FJ") totalFJ++;
      }
      row.totalP = totalP || "";
      row.totalF = totalF || "";
      row.totalA = totalA || "";
      row.totalFJ = totalFJ || "";
    }

    return row;
  });

  const verificationToken = randomUUID();
  const validationBase = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? undefined;
  const logoUrl = normalizePdfLogoUrl(escola?.logo_url, fallbackLogoUrl);

  const pdfBytes = await createInstitutionalPdf({
    title: isAlbum
      ? "Álbum Visual da Turma"
      : month
        ? "Mapa de Frequência Mensal"
        : isAttendance
          ? "Folha de Presença / Pauta de Chamada"
          : "Lista Nominal de Alunos",
    subtitle: "Documento Académico Oficial",
    orientation: isAttendance || month ? "landscape" : "portrait",
    school: {
      name: escola?.nome ?? "Escola",
      nif: escola?.nif,
      address: escola?.endereco,
      contacts: "",
      logoUrl,
      fallbackLogoUrl,
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
      let currentPage = page;
      let cursorY = contentStartY;
      const lineHeight = 16;
      const metaFontSize = 10;
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
      const metaLineOne = fitMetaLines(
        [
          isClasseScope ? `Escopo: Classe inteira` : `Turma: ${turma.nome ?? "—"}`,
          `Classe: ${classeNome}`,
          isClasseScope ? `Turmas incluídas: ${turmaIds.length}` : `Turno: ${turma.turno ?? "—"}`,
          month ? `Mês: ${monthNames[parseInt(month, 10) - 1]} / ${normalizedYear}` : "",
        ],
        width - 2 * margin,
        boldFont,
        metaFontSize
      );
      const metaLineTwo = fitMetaLines(
        [
          `Ano letivo: ${sessao?.ano ?? turma.ano_letivo ?? "—"}`,
          isClasseScope ? (cursoNome ? `Curso: ${cursoNome}` : "") : `Sala: ${turma.sala ?? "—"}`,
          disciplinaNome ? `Disciplina: ${disciplinaNome}` : "",
          professorNome ? `Prof: ${professorNome}` : "",
        ],
        width - 2 * margin,
        font,
        metaFontSize
      );

      for (const line of metaLineOne) {
        currentPage.drawText(line, { x: margin, y: cursorY, font: boldFont, size: metaFontSize });
        cursorY -= lineHeight;
      }

      for (const line of metaLineTwo) {
        currentPage.drawText(line, { x: margin, y: cursorY, font, size: metaFontSize });
        cursorY -= lineHeight;
      }

      cursorY -= 8;

      if (isAlbum) {
        // ALBUM MODE: Grid layout
        const cols = 5;
        const cardWidth = (width - 2 * margin) / cols;
        const cardHeight = 120;
        const photoSize = 70;
        let colIndex = 0;
        
        for (const aluno of alunos) {
          if (cursorY < margin + cardHeight) {
            currentPage = pdfDoc.addPage([page.getWidth(), page.getHeight()]);
            cursorY = currentPage.getHeight() - margin - 20;
            colIndex = 0;
          }

          const x = margin + colIndex * cardWidth;
          const centerX = x + cardWidth / 2;

          // Photo area
          let photoDrawn = false;
          const fotoUrl = aluno.foto_url as string | undefined;
          if (fotoUrl) {
            try {
              const { bytes: photoBytes, contentType } = await fetchImageBytes(fotoUrl);
              const photoFormat = detectImageFormat(photoBytes, contentType, fotoUrl);
              const photoImage =
                photoFormat === "png" ? await pdfDoc.embedPng(photoBytes) : await pdfDoc.embedJpg(photoBytes);
              const scale = photoSize / Math.max(photoImage.width, photoImage.height);
              const dims = photoImage.scale(scale);
              
              currentPage.drawImage(photoImage, {
                x: centerX - dims.width / 2,
                y: cursorY - photoSize + (photoSize - dims.height) / 2,
                width: dims.width,
                height: dims.height,
              });
              photoDrawn = true;
            } catch (e) {
              console.warn("Could not load student photo:", e);
            }
          }

          if (!photoDrawn) {
            currentPage.drawRectangle({
              x: centerX - photoSize / 2,
              y: cursorY - photoSize,
              width: photoSize,
              height: photoSize,
              color: rgb(0.95, 0.95, 0.95),
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 0.5,
            });

            const initials = (aluno.nome as string).split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
            currentPage.drawText(initials, {
              x: centerX - font.widthOfTextAtSize(initials, 16) / 2,
              y: cursorY - photoSize / 2 - 6,
              size: 16,
              font: boldFont,
              color: rgb(0.7, 0.7, 0.7),
            });
          }

          // Aluno labels
          const numeroStr = String(aluno.numero).padStart(2, "0");
          currentPage.drawText(numeroStr, {
            x: x + 10,
            y: cursorY - photoSize - 12,
            size: 8,
            font: boldFont,
          });

          const nomeCurto = (aluno.nome as string).split(" ").slice(0, 2).join(" ");
          currentPage.drawText(nomeCurto, {
            x: centerX - font.widthOfTextAtSize(nomeCurto, 8) / 2,
            y: cursorY - photoSize - 12,
            size: 8,
            font: boldFont,
          });

          const biText = `BI: ${aluno.bi}`;
          currentPage.drawText(biText, {
            x: centerX - font.widthOfTextAtSize(biText, 7) / 2,
            y: cursorY - photoSize - 22,
            size: 7,
            font,
          });

          if (aluno.status !== "ativo" && aluno.status !== "ativa") {
            const statusText = `(${String(aluno.status).toUpperCase()})`;
            currentPage.drawText(statusText, {
              x: centerX - font.widthOfTextAtSize(statusText, 7) / 2,
              y: cursorY - photoSize - 32,
              size: 7,
              font: boldFont,
              color: rgb(0.8, 0, 0),
            });
          }

          colIndex++;
          if (colIndex >= cols) {
            colIndex = 0;
            cursorY -= cardHeight;
          }
        }
        if (colIndex > 0) cursorY -= cardHeight;
      } else {
        // TABLE MODE
        let columns: Column[] = [];
        if (month) {
          columns = [
            { header: "Nº", key: "numero", width: 22, align: "center" },
            { header: "Nome do Aluno", key: "nome", width: 130 },
          ];

          const lastDayOfMonth = new Date(parseInt(normalizedYear, 10), parseInt(month, 10), 0).getDate();

          for (let day = 1; day <= 31; day += 1) {
            let bgColor: Column["bgColor"] | undefined = undefined;
            if (day <= lastDayOfMonth) {
              const date = new Date(parseInt(normalizedYear, 10), parseInt(month, 10) - 1, day);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              if (isWeekend) {
                bgColor = { r: 0.9, g: 0.9, b: 0.9 };
              }
            }
            columns.push({ 
              header: String(day), 
              key: `d${day}`, 
              width: 16.5, 
              align: "center",
              bgColor
            });
          }
          
          columns.push({ header: "P", key: "totalP", width: 18, align: "center" });
          columns.push({ header: "F", key: "totalF", width: 18, align: "center" });
          columns.push({ header: "A", key: "totalA", width: 18, align: "center" });
          columns.push({ header: "FJ", key: "totalFJ", width: 18, align: "center" });
        } else if (isAttendance) {
          columns = [
            { header: "Nº", key: "numero", width: 25, align: "center" },
            { header: "Nome do Aluno", key: "nome", width: 220 },
            { header: "G", key: "genero", width: 20, align: "center" },
            ...Array.from({ length: 9 }).map((_, idx) => ({ header: "", key: `d${idx + 1}`, width: 45 })),
            { header: "Assinatura / Obs", key: "obs", width: 80 },
          ];
        } else {
          // NOMINAL LIST: Extended Academic Data
          columns = [
            { header: "Nº", key: "numero", width: 25, align: "center" },
            ...(isClasseScope ? [{ header: "Turma", key: "turma", width: 80 } as Column] : []),
            { header: "Nome do Aluno", key: "nome", width: isClasseScope ? 130 : 180 },
            { header: "G", key: "genero", width: 20, align: "center" },
            { header: "Nascimento", key: "data_nascimento", width: 70 },
            { header: "Idade", key: "idade", width: 35, align: "center" },
            { header: "Naturalidade", key: "naturalidade", width: 90 },
            { header: "Documento (BI)", key: "bi", width: 80 },
          ];

          // If showing all status, highlight the non-active ones
          if (includeAllStatus) {
            alunos.forEach(a => {
              if (a.status !== "ativo" && a.status !== "ativa") {
                a.nome = `${a.nome} [${String(a.status).toUpperCase()}]`;
              }
            });
          }
        }

        const { lastPage, lastY } = await drawTable(columns, alunos, {
          page: currentPage,
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
        currentPage = lastPage;
      }

      if (month) {
        currentPage.drawText("Legenda: P = Presente | F = Falta | A = Atraso | FJ = Falta Justificada", {
          x: margin,
          y: cursorY + 5,
          font,
          size: 8,
        });
        cursorY -= 15;
      }

      const qrSize = 65;
      const signatureText = buildSignatureLine({
        signerName: undefined,
        signerRole: "Diretor(a)",
      });

      if (verificationUrl) {
        const qrImage = await createQrImage(pdfDoc, verificationUrl);
        const qrX = width - margin - qrSize - 10;
        const qrY = Math.max(cursorY - qrSize - 15, margin + 40);
        
        // Authenticity Box/Seal
        currentPage.drawRectangle({
          x: margin,
          y: qrY - 5,
          width: width - 2 * margin,
          height: qrSize + 20,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.5,
          color: rgb(0.98, 0.98, 0.98),
        });

        currentPage.drawImage(qrImage, {
          x: qrX,
          y: qrY + 5,
          width: qrSize,
          height: qrSize,
        });

        currentPage.drawText("AUTENTICIDADE DIGITAL", {
          x: margin + 10,
          y: qrY + qrSize + 5,
          font: boldFont,
          size: 7,
          color: rgb(0.4, 0.4, 0.4),
        });

        currentPage.drawText(signatureText, {
          x: margin + 10,
          y: qrY + qrSize - 15,
          font: boldFont,
          size: 10,
        });

        const infoText = "Este documento foi gerado pelo Sistema de Gestão Escolar e possui validade jurídica mediante verificação via QR Code.";
        currentPage.drawText(infoText, {
          x: margin + 10,
          y: qrY + qrSize - 30,
          font,
          size: 7,
          color: rgb(0.5, 0.5, 0.5),
        });

        const dateText = `Emitido em: ${new Date().toLocaleString("pt-PT")}`;
        currentPage.drawText(dateText, {
          x: margin + 10,
          y: qrY + qrSize - 40,
          font,
          size: 7,
          color: rgb(0.5, 0.5, 0.5),
        });
      } else {
        currentPage.drawText(signatureText, {
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
