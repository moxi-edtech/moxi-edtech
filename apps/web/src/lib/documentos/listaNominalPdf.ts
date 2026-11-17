import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { rgb } from "pdf-lib";
import type { Database } from "~types/supabase";
import { createInstitutionalPdf, detectImageFormat, fetchImageBytes } from "@/lib/pdf/documentTemplate";
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr";
import { drawTable, type Column } from "@/lib/pdf/table";
import { renderNominalA4, type NominalA4Row } from "@/lib/documentos/nominalA4";
import { LISTA_NOMINAL_MODES, classifyMatricula, resumoExclusoes, type ListaNominalMode } from "@/lib/documentos/listaNominalPolicy";
import { loadNominalRoster } from "@/lib/documentos/listaNominalService";

type Client = SupabaseClient<Database>;

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
  mode?: ListaNominalMode;
  enableQr?: boolean;
  camposSensiveis?: boolean;
  emissor?: string;
  onRowsCount?: (count: number) => void;
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
  mode: requestedMode,
  enableQr = false,
  camposSensiveis = false,
  emissor = "Sistema KLASSE",
  onRowsCount,
  fallbackLogoUrl,
}: ListaNominalPdfParams) {
  const normalizedYear = year || String(new Date().getFullYear());
  const roster = await loadNominalRoster({
    supabase, escolaId, turmaId, classeId, year: normalizedYear,
    mode: requestedMode, includeAllStatus, pdfFields: true,
    extendedStudentFields: camposSensiveis || isAlbum || Boolean(month) || isAttendance,
  });
  const {
    turma, turmaIds, turmaById, classeNome, cursoNome, escola,
    sessao, mode, isClasseScope, seleccao, sortedMatriculas,
  } = roster;

  const extraDataRes = disciplinaId && turmaId
    ? await Promise.all([
        supabase.from("disciplinas_catalogo").select("nome").eq("id", disciplinaId).maybeSingle(),
        supabase.from("turma_disciplinas_professores")
          .select("professores(profiles(nome))")
          .eq("turma_id", turmaId).eq("disciplina_id", disciplinaId).maybeSingle(),
      ])
    : [null, null];

  const disciplinaNome = (extraDataRes?.[0] as any)?.data?.nome || "";
  const professorNome = (extraDataRes?.[1] as any)?.data?.professores?.profiles?.nome || "";

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

  const alunos = sortedMatriculas.map((matricula, index) => {
    const aluno = Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos;
    const turmaAluno = turmaById.get(matricula.turma_id ?? "");
    const row: Record<string, string | number> = {
      id: matricula.id,
      processo: aluno?.numero_processo?.trim() || "NÃO ATRIBUÍDO",
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
      categoria: classifyMatricula(matricula.status),
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

  onRowsCount?.(alunos.length);
  const verificationToken = enableQr ? randomUUID() : undefined;
  const validationBase = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? undefined;
  const logoUrl = normalizePdfLogoUrl(escola?.logo_url, fallbackLogoUrl);

  // Documento nominal diário: layout próprio, paginação real e minimização de dados.
  // Mapas, pautas de chamada e álbum preservam o renderer anterior.
  if (!month && !isAttendance && !isAlbum) {
    let logoBytes: Uint8Array | undefined;
    if (logoUrl) {
      try {
        logoBytes = (await fetchImageBytes(logoUrl)).bytes;
      } catch {
        // Um logótipo temporariamente indisponível não bloqueia a lista.
      }
    }
    let qrImageBytes: Uint8Array | undefined;
    if (enableQr) {
      if (!validationBase || !verificationToken) {
        throw new Error("Verificação QR indisponível neste ambiente");
      }
      const verifyUrl = validationBase.replace(/\/$/, "") + "/" + verificationToken;
      const qrRes = await fetch("https://quickchart.io/qr?text=" + encodeURIComponent(verifyUrl) + "&margin=1&size=240");
      if (!qrRes.ok) throw new Error("Falha ao gerar o código QR");
      qrImageBytes = new Uint8Array(await qrRes.arrayBuffer());
    }
    const yearValue = String(sessao?.ano ?? turma.ano_letivo ?? "—");
    const yearLabel = /^\d{4}$/.test(yearValue)
      ? yearValue + "/" + (Number(yearValue) + 1)
      : yearValue;
    const estados: Record<string, string> = {
      activa: "Activa", concluida: "Concluída", transferida: "Transferida",
      trancada: "Trancada", cancelada: "Cancelada",
      pendente: "Pendente", desconhecida: "Não definido",
    };
    const linhas: NominalA4Row[] = alunos.map((row) => ({
      numero: String(row.numero ?? "—"),
      processo: String(row.processo ?? "NÃO ATRIBUÍDO"),
      nome: String(row.nome ?? "—"),
      turma: String(row.turma ?? turma.nome ?? "—"),
      estado: estados[String(row.categoria)] ?? "Não definido",
      nascimento: String(row.data_nascimento ?? "—"),
      naturalidade: String(row.naturalidade ?? "—"),
      bi: String(row.bi ?? "—"),
    }));
    const excluidos = (seleccao.totalOrigem - alunos.length) + " (" + resumoExclusoes(seleccao.excluidos) + ")";
    return Buffer.from(await renderNominalA4({
      escola: escola?.nome ?? "Escola",
      turma: isClasseScope ? "Todas as turmas da classe " + classeNome : turma.nome ?? "Turma",
      anoLetivo: yearLabel,
      modo: LISTA_NOMINAL_MODES[mode],
      alunos: linhas,
      excluidos,
      emissor,
      camposSensiveis,
      logoBytes,
      qrImageBytes,
    }));
  }

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
          "Modo: " + LISTA_NOMINAL_MODES[mode],
          disciplinaNome ? `Disciplina: ${disciplinaNome}` : "",
          professorNome ? `Prof: ${professorNome}` : "",
        ],
        width - 2 * margin,
        font,
        metaFontSize
      );

      const excluidosCount = seleccao.totalOrigem - alunos.length;
      const resumoDaLista = "Alunos na lista: " + alunos.length + " | Excluídos: " + excluidosCount + " (" + resumoExclusoes(seleccao.excluidos) + ")";
      metaLineTwo.push(...fitMetaLines([resumoDaLista], width - 2 * margin, font, 8));
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

          // Identificação explícita: transferida/cancelada não aparece como activa.
          for (const aluno of alunos) {
            if (["transferida", "trancada", "cancelada", "pendente", "desconhecida"].includes(String(aluno.categoria))) {
              aluno.nome = String(aluno.nome) + " [" + String(aluno.status).toUpperCase() + "]";
            }
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
