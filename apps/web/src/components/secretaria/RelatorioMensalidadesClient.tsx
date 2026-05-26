"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BoardExecutivePanel } from "@/components/secretaria/BoardExecutivePanel";
import { BoardPressurePanel } from "@/components/secretaria/BoardPressurePanel";
import { FinanceInsightsPanel } from "@/components/secretaria/FinanceInsightsPanel";
import { FinancialHealthInsightsPanel } from "@/components/secretaria/FinancialHealthInsightsPanel";
import { QuickViewTimeline } from "@/components/secretaria/QuickViewTimeline";
import { useFinanceInsights } from "@/hooks/useFinanceInsights";
import { useFinancialHealthInsights } from "@/hooks/useFinancialHealthInsights";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Activity
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import * as XLSX from "xlsx";

type Mensal = {
  anoLetivo: number;
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type CaptacaoItem = {
  label: string;
  matriculas: number;
  confirmacoes: number;
  bolsistas: number;
  total: number;
  detalhes_mensais: Record<string, { matriculas: number; confirmacoes: number; bolsistas: number }>;
};

type DespesaItem = {
  label: string;
  total: number;
  qtd: number;
};

type PorTurma = {
  turmaId: string;
  turmaNome: string;
  classe: string | null;
  turno: string | null;
  anoLetivo: number;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type SessionItem = {
  id: string;
  nome?: string | null;
  status?: string | null;
  ano_letivo?: number | string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

type ResumoFinanceiro = {
  mensalidades: number;
  emAtraso: number;
  pagasAdiantadas: number;
  parciais: number;
  previsto: number;
  pago: number;
  pagoAdiantado: number;
  parcialEmAberto: number;
  atraso: number;
  despesasTotal: number;
  entradasTotal: number;
  saldoAnterior: number;
  saldoPeriodo: number;
  saldoAcumulado: number;
  taxaAtrasoPct: number;
};

type FluxoMensalItem = {
  mesRef: string;
  saldoAnterior: number;
  entradasTotal: number;
  saidasTotal: number;
  diferenca: number;
  saldoFinal: number;
};

type InadimplenciaClasseItem = {
  mesRef: string;
  classeId: string;
  classeLabel: string;
  qtdEmAtraso: number;
  valorUnitarioMedio: number;
  totalEmAtraso: number;
  qtdParciais: number;
  totalParcialEmAberto: number;
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

function toCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMonthRef(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
    month: "short",
    year: "2-digit",
  });
}

function normalizeMonthKey(value: string) {
  return value.slice(0, 7);
}

function EducationalEmptyState({
  title,
  message,
  ctaHref,
  ctaLabel,
  colSpan,
}: {
  title: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {ctaLabel}
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default function RelatorioMensalidadesClient() {
  const params = useParams();
  const escolaId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensal, setMensal] = useState<Mensal[]>([]);
  const [porTurma, setPorTurma] = useState<PorTurma[]>([]);
  const [captacao, setCaptacao] = useState<CaptacaoItem[]>([]);
  const [despesas, setDespesas] = useState<DespesaItem[]>([]);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [resumoFinanceiro, setResumoFinanceiro] = useState<ResumoFinanceiro | null>(null);
  const [fluxoMensal, setFluxoMensal] = useState<FluxoMensalItem[]>([]);
  const [inadimplenciaClasse, setInadimplenciaClasse] = useState<InadimplenciaClasseItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [boardMode, setBoardMode] = useState(false);

  const sessionSelecionada = useMemo(
    () => sessions.find((s) => s.id === selectedSession),
    [sessions, selectedSession]
  );

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const texto = String(valor);
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const anoLetivoAtivo = useMemo(() => {
    const candidatos = [
      sessionSelecionada?.ano_letivo,
      sessionSelecionada?.nome,
      sessionSelecionada?.data_inicio,
      sessionSelecionada?.data_fim,
    ];

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato);
      if (ano) return ano;
    }
    return new Date().getFullYear();
  }, [sessionSelecionada]);

  const resumoCalculado = useMemo<ResumoFinanceiro>(() => {
    return mensal.reduce(
      (acc, item) => {
        acc.previsto += item.totalPrevisto;
        acc.pago += item.totalPago;
        acc.atraso += item.totalEmAtraso;
        acc.pagoAdiantado += item.totalPagoAdiantado;
        acc.parcialEmAberto += item.totalParcialEmAberto;
        acc.mensalidades += item.qtdMensalidades;
        acc.emAtraso += item.qtdEmAtraso;
        acc.pagasAdiantadas += item.qtdPagasAdiantadas;
        acc.parciais += item.qtdParciais;
        return acc;
      },
      {
        previsto: 0,
        pago: 0,
        atraso: 0,
        pagoAdiantado: 0,
        parcialEmAberto: 0,
        mensalidades: 0,
        emAtraso: 0,
        pagasAdiantadas: 0,
        parciais: 0,
        despesasTotal: totalDespesas,
        entradasTotal: 0,
        saldoAnterior: 0,
        saldoPeriodo: -totalDespesas,
        saldoAcumulado: -totalDespesas,
        taxaAtrasoPct: 0,
      }
    );
  }, [mensal, totalDespesas]);

  const resumo = useMemo<ResumoFinanceiro>(() => {
    if (resumoFinanceiro) return resumoFinanceiro;
    const taxaAtrasoPct =
      resumoCalculado.mensalidades > 0
        ? Number(((resumoCalculado.emAtraso / resumoCalculado.mensalidades) * 100).toFixed(1))
        : 0;
    return {
      ...resumoCalculado,
      taxaAtrasoPct,
    };
  }, [resumoCalculado, resumoFinanceiro]);

  const totalEntradasResultado = resumoFinanceiro ? resumo.entradasTotal : resumo.pago;
  const totalSaidasResultado = resumoFinanceiro ? resumo.despesasTotal : totalDespesas;
  const saldoFinalResultado = resumoFinanceiro ? resumo.saldoAcumulado : resumo.pago - totalDespesas;

  const serieMensalOrdenada = useMemo(
    () => [...mensal].sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano)),
    [mensal]
  );

  const rankingTurmasOrdenado = useMemo(
    () =>
      [...porTurma].sort((a, b) => {
        if (b.totalEmAtraso !== a.totalEmAtraso) return b.totalEmAtraso - a.totalEmAtraso;
        if (b.qtdParciais !== a.qtdParciais) return b.qtdParciais - a.qtdParciais;
        return a.turmaNome.localeCompare(b.turmaNome, "pt");
      }),
    [porTurma]
  );

  const fluxoMensalOrdenado = useMemo(
    () => [...fluxoMensal].sort((a, b) => a.mesRef.localeCompare(b.mesRef)),
    [fluxoMensal]
  );

  const inadimplenciaClasseOrdenada = useMemo(
    () =>
      [...inadimplenciaClasse].sort((a, b) => {
        if (a.mesRef !== b.mesRef) return a.mesRef.localeCompare(b.mesRef);
        if (b.totalEmAtraso !== a.totalEmAtraso) return b.totalEmAtraso - a.totalEmAtraso;
        return a.classeLabel.localeCompare(b.classeLabel, "pt");
      }),
    [inadimplenciaClasse]
  );

  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, { key: string; label: string; metric: number }>();

    serieMensalOrdenada.forEach((row) => {
      const key = `${row.ano}-${String(row.mes).padStart(2, "0")}`;
      monthMap.set(key, {
        key,
        label: row.labelMes,
        metric: row.totalPago || row.totalEmAtraso || row.totalPrevisto,
      });
    });

    fluxoMensalOrdenado.forEach((row) => {
      const key = normalizeMonthKey(row.mesRef);
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          label: formatMonthRef(row.mesRef),
          metric: row.entradasTotal || row.saidasTotal || Math.abs(row.diferenca),
        });
      }
    });

    inadimplenciaClasseOrdenada.forEach((row) => {
      const key = normalizeMonthKey(row.mesRef);
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          label: formatMonthRef(row.mesRef),
          metric: row.totalEmAtraso || row.totalParcialEmAberto,
        });
      }
    });

    return [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [fluxoMensalOrdenado, inadimplenciaClasseOrdenada, serieMensalOrdenada]);

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === "all") return "Período completo";
    return availableMonths.find((item) => item.key === selectedMonth)?.label ?? selectedMonth;
  }, [availableMonths, selectedMonth]);

  const mensalFiltrado = useMemo(
    () =>
      selectedMonth === "all"
        ? serieMensalOrdenada
        : serieMensalOrdenada.filter(
            (row) => `${row.ano}-${String(row.mes).padStart(2, "0")}` === selectedMonth
          ),
    [selectedMonth, serieMensalOrdenada]
  );

  const fluxoMensalFiltrado = useMemo(
    () =>
      selectedMonth === "all"
        ? fluxoMensalOrdenado
        : fluxoMensalOrdenado.filter((row) => normalizeMonthKey(row.mesRef) === selectedMonth),
    [fluxoMensalOrdenado, selectedMonth]
  );

  const inadimplenciaClasseFiltrada = useMemo(
    () =>
      selectedMonth === "all"
        ? inadimplenciaClasseOrdenada
        : inadimplenciaClasseOrdenada.filter((row) => normalizeMonthKey(row.mesRef) === selectedMonth),
    [inadimplenciaClasseOrdenada, selectedMonth]
  );

  const highlightedDebtMonth = useMemo(() => {
    if (selectedMonth !== "all") return selectedMonth;
    if (inadimplenciaClasseOrdenada.length === 0) return "all";

    const totalsByMonth = inadimplenciaClasseOrdenada.reduce<Record<string, number>>((acc, row) => {
      const key = normalizeMonthKey(row.mesRef);
      acc[key] = (acc[key] || 0) + row.totalEmAtraso;
      return acc;
    }, {});

    return Object.entries(totalsByMonth).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "all";
  }, [inadimplenciaClasseOrdenada, selectedMonth]);

  const executiveHighlights = useMemo(
    () => [...inadimplenciaClasseFiltrada].sort((a, b) => b.totalEmAtraso - a.totalEmAtraso).slice(0, 5),
    [inadimplenciaClasseFiltrada]
  );

  const diamondTurmas = useMemo(() => {
    return rankingTurmasOrdenado.filter(t => t.qtdEmAtraso === 0 && t.qtdParciais === 0 && t.qtdMensalidades > 0);
  }, [rankingTurmasOrdenado]);

  const insights = useFinanceInsights({
    despesas,
    inadimplenciaClasseOrdenada,
    rankingTurmasOrdenado,
    selectedMonth,
    serieMensalOrdenada,
  });

  const { financialInsights, healthScore } = useFinancialHealthInsights({
    executiveHighlights,
    resumo,
    totalEntradasResultado,
    totalSaidasResultado,
  });

  const openInsight = (targetId: string, monthKey?: string) => {
    if (monthKey) {
      setSelectedMonth(monthKey);
    }

    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    if (selectedMonth === "all") return;
    if (!availableMonths.some((item) => item.key === selectedMonth)) {
      setSelectedMonth("all");
    }
  }, [availableMonths, selectedMonth]);

  const exportExcel = async () => {
    const resumoRows = [
      { indicador: "Ano letivo", valor: anoLetivoAtivo },
      { indicador: "Mensalidades", valor: resumo.mensalidades },
      { indicador: "Previsto", valor: resumo.previsto },
      { indicador: "Pago", valor: resumo.pago },
      { indicador: "Em atraso", valor: resumo.atraso },
      { indicador: "Pagas adiantadas", valor: resumo.pagasAdiantadas },
      { indicador: "Pago adiantado", valor: resumo.pagoAdiantado },
      { indicador: "Parciais", valor: resumo.parciais },
      { indicador: "Saldo parcial", valor: resumo.parcialEmAberto },
    ];

    const mensalRows = mensalFiltrado.map((row) => ({
      competencia: row.labelMes,
      mensalidades: row.qtdMensalidades,
      em_atraso: row.qtdEmAtraso,
      pagas_adiantadas: row.qtdPagasAdiantadas,
      parciais: row.qtdParciais,
      previsto: row.totalPrevisto,
      pago: row.totalPago,
      pago_adiantado: row.totalPagoAdiantado,
      saldo_parcial: row.totalParcialEmAberto,
      total_em_atraso: row.totalEmAtraso,
      inadimplencia_pct: Number(row.inadimplenciaPct.toFixed(1)),
    }));

    const turmaRows = rankingTurmasOrdenado.map((row) => ({
      turma: row.turmaNome,
      classe: row.classe ?? "—",
      turno: row.turno ?? "—",
      mensalidades: row.qtdMensalidades,
      em_atraso: row.qtdEmAtraso,
      pagas_adiantadas: row.qtdPagasAdiantadas,
      parciais: row.qtdParciais,
      previsto: row.totalPrevisto,
      pago: row.totalPago,
      pago_adiantado: row.totalPagoAdiantado,
      saldo_parcial: row.totalParcialEmAberto,
      total_em_atraso: row.totalEmAtraso,
      inadimplencia_pct: Number(row.inadimplenciaPct.toFixed(1)),
    }));

    const fluxoRows = fluxoMensalFiltrado.map((row) => ({
      mes_ref: row.mesRef,
      saldo_anterior: row.saldoAnterior,
      entradas_total: row.entradasTotal,
      saidas_total: row.saidasTotal,
      diferenca: row.diferenca,
      saldo_final: row.saldoFinal,
    }));

    const inadimplenciaRows = inadimplenciaClasseFiltrada.map((row) => ({
      mes_ref: row.mesRef,
      classe: row.classeLabel,
      qtd_em_atraso: row.qtdEmAtraso,
      valor_unitario_medio: row.valorUnitarioMedio,
      total_em_atraso: row.totalEmAtraso,
      qtd_parciais: row.qtdParciais,
      total_parcial_em_aberto: row.totalParcialEmAberto,
    }));

    const workbook = XLSX.utils.book_new();

    const resumoSheet = XLSX.utils.json_to_sheet(resumoRows);
    const mensalSheet = XLSX.utils.json_to_sheet(mensalRows);
    const turmaSheet = XLSX.utils.json_to_sheet(turmaRows);
    const fluxoSheet = XLSX.utils.json_to_sheet(fluxoRows);
    const inadimplenciaSheet = XLSX.utils.json_to_sheet(inadimplenciaRows);

    XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");
    XLSX.utils.book_append_sheet(workbook, mensalSheet, "Serie Mensal");
    XLSX.utils.book_append_sheet(workbook, turmaSheet, "Por Turma");
    XLSX.utils.book_append_sheet(workbook, fluxoSheet, "Fluxo Mensal");
    XLSX.utils.book_append_sheet(workbook, inadimplenciaSheet, "Inadimplencia Classe");

    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    downloadBlob(
      `relatorio_mensalidades_${anoLetivoAtivo}.xlsx`,
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
  };

  const exportPdf = async () => {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 36;
    const bottomMargin = 30;
    const headerColor = rgb(0.1, 0.15, 0.24);
    const mutedColor = rgb(0.45, 0.49, 0.56);
    const borderColor = rgb(0.87, 0.89, 0.92);
    const stripeColor = rgb(0.97, 0.98, 0.99);
    const valueColor = rgb(0.08, 0.1, 0.14);
    const paidBg = rgb(0.93, 0.98, 0.95);
    const paidBorder = rgb(0.69, 0.89, 0.77);
    const lateBg = rgb(0.99, 0.94, 0.94);
    const lateBorder = rgb(0.95, 0.76, 0.76);
    const lightBg = rgb(0.985, 0.988, 0.992);

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    const drawText = (
      targetPage: PDFPage,
      text: string,
      x: number,
      y: number,
      size: number,
      font: PDFFont,
      color = valueColor
    ) => {
      targetPage.drawText(text, { x, y, size, font, color });
    };

    const ensureSpace = (needed: number) => {
      if (cursorY - needed >= bottomMargin) return;
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    };

    const drawSectionTitle = (title: string, subtitle?: string) => {
      ensureSpace(36);
      drawText(page, title, margin, cursorY, 14, fontBold, headerColor);
      cursorY -= 16;
      if (subtitle) {
        drawText(page, subtitle, margin, cursorY, 9, fontRegular, mutedColor);
        cursorY -= 16;
      } else {
        cursorY -= 8;
      }
    };

    const drawKpiCard = (
      x: number,
      y: number,
      width: number,
      height: number,
      label: string,
      value: string,
      note: string,
      options?: { bg?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb>; value?: ReturnType<typeof rgb> }
    ) => {
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: options?.bg ?? rgb(1, 1, 1),
        borderColor: options?.border ?? borderColor,
        borderWidth: 0.8,
      });
      drawText(page, label.toUpperCase(), x + 12, y - 18, 8, fontBold, mutedColor);
      drawText(page, value, x + 12, y - 42, 18, fontBold, options?.value ?? valueColor);
      drawText(page, note, x + 12, y - 58, 8, fontRegular, mutedColor);
    };

    const drawTable = (
      columns: Array<{ key: string; label: string; width: number; align?: "left" | "right" }>,
      rows: Array<Record<string, string>>
    ) => {
      const rowHeight = 18;
      ensureSpace(rowHeight * 2);

      let x = margin;
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight + 2,
        width: columns.reduce((acc, col) => acc + col.width, 0),
        height: rowHeight,
        color: rgb(0.94, 0.96, 0.98),
        borderColor,
        borderWidth: 0.5,
      });

      for (const column of columns) {
        drawText(page, column.label, x + 4, cursorY - 11, 8, fontBold, headerColor);
        x += column.width;
      }
      cursorY -= rowHeight;

      rows.forEach((row, index) => {
        ensureSpace(rowHeight + 6);
        const totalWidth = columns.reduce((acc, col) => acc + col.width, 0);
        page.drawRectangle({
          x: margin,
          y: cursorY - rowHeight + 2,
          width: totalWidth,
          height: rowHeight,
          color: index % 2 === 0 ? stripeColor : rgb(1, 1, 1),
          borderColor,
          borderWidth: 0.25,
        });

        let colX = margin;
        columns.forEach((column) => {
          const raw = row[column.key] ?? "";
          const text = String(raw);
          const textWidth = fontRegular.widthOfTextAtSize(text, 8);
          const textX =
            column.align === "right"
              ? colX + column.width - textWidth - 4
              : colX + 4;
          drawText(page, text, textX, cursorY - 11, 8, fontRegular, valueColor);
          colX += column.width;
        });

        cursorY -= rowHeight;
      });

      cursorY -= 12;
    };

    drawText(page, "RELATÓRIO DE MENSALIDADES", margin, cursorY, 20, fontBold, headerColor);
    cursorY -= 24;
    drawText(
      page,
      `Ano letivo ${anoLetivoAtivo} • Emitido em ${new Date().toLocaleString("pt-AO")}`,
      margin,
      cursorY,
      10,
      fontRegular,
      mutedColor
    );
    cursorY -= 24;

    drawSectionTitle("Resumo executivo");
    const primaryCardWidth = (pageWidth - margin * 2 - 18) / 4;
    const primaryTopY = cursorY;
    drawKpiCard(margin, primaryTopY, primaryCardWidth, 72, "Ano letivo", String(anoLetivoAtivo), `${resumo.mensalidades} mensalidades no período`, {
      bg: rgb(1, 1, 1),
    });
    drawKpiCard(margin + primaryCardWidth + 6, primaryTopY, primaryCardWidth, 72, "Previsto", kwanza.format(resumo.previsto), "Base total emitida", {
      bg: rgb(1, 1, 1),
    });
    drawKpiCard(margin + (primaryCardWidth + 6) * 2, primaryTopY, primaryCardWidth, 72, "Pago", kwanza.format(resumo.pago), "Arrecadação confirmada", {
      bg: paidBg,
      border: paidBorder,
      value: rgb(0.04, 0.42, 0.22),
    });
    drawKpiCard(margin + (primaryCardWidth + 6) * 3, primaryTopY, primaryCardWidth, 72, "Em atraso", kwanza.format(resumo.atraso), `${resumo.emAtraso} mensalidades em incumprimento`, {
      bg: lateBg,
      border: lateBorder,
      value: rgb(0.66, 0.12, 0.12),
    });
    cursorY -= 86;

    const secondaryCardWidth = (pageWidth - margin * 2 - 18) / 4;
    const secondaryTopY = cursorY;
    drawKpiCard(margin, secondaryTopY, secondaryCardWidth, 64, "Pagas adiantadas", String(resumo.pagasAdiantadas), kwanza.format(resumo.pagoAdiantado), {
      bg: lightBg,
      value: rgb(0.11, 0.4, 0.62),
    });
    drawKpiCard(margin + secondaryCardWidth + 6, secondaryTopY, secondaryCardWidth, 64, "Parciais", String(resumo.parciais), "Pagamentos incompletos", {
      bg: lightBg,
      value: rgb(0.72, 0.42, 0.06),
    });
    drawKpiCard(margin + (secondaryCardWidth + 6) * 2, secondaryTopY, secondaryCardWidth, 64, "Saldo parcial", kwanza.format(resumo.parcialEmAberto), "Ainda por liquidar", {
      bg: lightBg,
      value: rgb(0.72, 0.42, 0.06),
    });
    drawKpiCard(
      margin + (secondaryCardWidth + 6) * 3,
      secondaryTopY,
      secondaryCardWidth,
      64,
      "Taxa de atraso",
      `${resumo.taxaAtrasoPct.toFixed(1)}%`,
      "Sobre o total do período",
      {
        bg: lightBg,
      }
    );
    cursorY -= 82;

    drawSectionTitle("Série mensal", "Competência, adiantamentos e saldo parcial por mês.");
    drawTable(
      [
        { key: "competencia", label: "Competência", width: 70 },
        { key: "mensalidades", label: "Mens.", width: 55, align: "right" },
        { key: "atraso", label: "Atraso", width: 55, align: "right" },
        { key: "adiantadas", label: "Adianta.", width: 60, align: "right" },
        { key: "parciais", label: "Parciais", width: 55, align: "right" },
        { key: "previsto", label: "Previsto", width: 95, align: "right" },
        { key: "pago", label: "Pago", width: 95, align: "right" },
        { key: "pagoAdiantado", label: "Pago ad.", width: 95, align: "right" },
        { key: "saldoParcial", label: "Saldo parc.", width: 95, align: "right" },
        { key: "inad", label: "Inad. %", width: 65, align: "right" },
      ],
      mensalFiltrado.map((row) => ({
        competencia: row.labelMes,
        mensalidades: String(row.qtdMensalidades),
        atraso: String(row.qtdEmAtraso),
        adiantadas: String(row.qtdPagasAdiantadas),
        parciais: String(row.qtdParciais),
        previsto: kwanza.format(row.totalPrevisto),
        pago: kwanza.format(row.totalPago),
        pagoAdiantado: kwanza.format(row.totalPagoAdiantado),
        saldoParcial: kwanza.format(row.totalParcialEmAberto),
        inad: `${row.inadimplenciaPct.toFixed(1)}%`,
      }))
    );

    drawSectionTitle("Ranking por turma", "Ordenado por maior saldo em atraso.");
    drawTable(
      [
        { key: "turma", label: "Turma", width: 170 },
        { key: "classe", label: "Classe", width: 120 },
        { key: "turno", label: "Turno", width: 50 },
        { key: "atraso", label: "Atraso", width: 55, align: "right" },
        { key: "adiantadas", label: "Adianta.", width: 60, align: "right" },
        { key: "parciais", label: "Parciais", width: 55, align: "right" },
        { key: "saldoParcial", label: "Saldo parc.", width: 95, align: "right" },
        { key: "totalAtraso", label: "Total atraso", width: 105, align: "right" },
        { key: "inad", label: "Inad. %", width: 65, align: "right" },
      ],
      rankingTurmasOrdenado.map((row) => ({
        turma: row.turmaNome,
        classe: row.classe ?? "—",
        turno: row.turno ?? "—",
        atraso: String(row.qtdEmAtraso),
        adiantadas: String(row.qtdPagasAdiantadas),
        parciais: String(row.qtdParciais),
        saldoParcial: kwanza.format(row.totalParcialEmAberto),
        totalAtraso: kwanza.format(row.totalEmAtraso),
        inad: `${row.inadimplenciaPct.toFixed(1)}%`,
      }))
    );

    drawSectionTitle("Fluxo mensal", "Saldo anterior, entradas, saídas e saldo final por mês.");
    drawTable(
      [
        { key: "mesRef", label: "Mês", width: 90 },
        { key: "saldoAnterior", label: "Saldo ant.", width: 110, align: "right" },
        { key: "entradas", label: "Entradas", width: 110, align: "right" },
        { key: "saidas", label: "Saídas", width: 110, align: "right" },
        { key: "diferenca", label: "Dif.", width: 100, align: "right" },
        { key: "saldoFinal", label: "Saldo final", width: 110, align: "right" },
      ],
      fluxoMensalFiltrado.map((row) => ({
        mesRef: new Date(`${row.mesRef}T00:00:00`).toLocaleDateString("pt-PT", { month: "2-digit", year: "numeric" }),
        saldoAnterior: kwanza.format(row.saldoAnterior),
        entradas: kwanza.format(row.entradasTotal),
        saidas: kwanza.format(row.saidasTotal),
        diferenca: kwanza.format(row.diferenca),
        saldoFinal: kwanza.format(row.saldoFinal),
      }))
    );

    drawSectionTitle("Inadimplência por classe", "Atrasos e saldos parciais agrupados por classe.");
    drawTable(
      [
        { key: "mesRef", label: "Mês", width: 70 },
        { key: "classe", label: "Classe", width: 150 },
        { key: "qtdAtraso", label: "Qtd atraso", width: 65, align: "right" },
        { key: "valorMedio", label: "Valor médio", width: 95, align: "right" },
        { key: "totalAtraso", label: "Total atraso", width: 95, align: "right" },
        { key: "parciais", label: "Parciais", width: 60, align: "right" },
        { key: "saldoParcial", label: "Saldo parc.", width: 95, align: "right" },
      ],
      inadimplenciaClasseFiltrada.map((row) => ({
        mesRef: new Date(`${row.mesRef}T00:00:00`).toLocaleDateString("pt-PT", { month: "2-digit", year: "numeric" }),
        classe: row.classeLabel,
        qtdAtraso: String(row.qtdEmAtraso),
        valorMedio: kwanza.format(row.valorUnitarioMedio),
        totalAtraso: kwanza.format(row.totalEmAtraso),
        parciais: String(row.qtdParciais),
        saldoParcial: kwanza.format(row.totalParcialEmAberto),
      }))
    );

    const bytes = await pdfDoc.save();
    const pdfBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(pdfBuffer).set(bytes);
    downloadBlob("relatorio_mensalidades.pdf", new Blob([pdfBuffer], { type: "application/pdf" }));
  };

  useEffect(() => {
    if (!escolaId) return;
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/secretaria/school-sessions?escolaId=${escolaId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.ok) {
          const sessionItems = Array.isArray(json.data)
            ? (json.data as SessionItem[])
            : Array.isArray(json.items)
              ? (json.items as SessionItem[])
              : [];
          setSessions(sessionItems);
          const activeSession = sessionItems.find((s) => s.status === "ativa");
          if (activeSession) setSelectedSession(activeSession.id);
          else if (sessionItems.length > 0) setSelectedSession(sessionItems[0].id);
        }
      } catch {}
    }
    void fetchSessions();
  }, [escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;
    let cancelled = false;

    async function loadResumo() {
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/resumo?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setResumoFinanceiro(json.resumo || null);
      } catch {
        if (!cancelled) setResumoFinanceiro(null);
      }
    }

    void loadResumo();
    return () => {
      cancelled = true;
    };
  }, [selectedSession, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/propinas?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || `Erro ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setMensal(json.mensal || []);
          setPorTurma(json.porTurma || []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar relatório");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedSession, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    async function loadCaptacao() {
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/captacao?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const j = await res.json();
          setCaptacao(j.items || []);
        }
      } catch (e) {
        console.error("Erro ao carregar captação", e);
      }
    }
    void loadCaptacao();
  }, [selectedSession, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    async function loadDespesas() {
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/despesas?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const j = await res.json();
          setDespesas(j.items || []);
          setTotalDespesas(j.totalGeral || 0);
        }
      } catch (e) {
        console.error("Erro ao carregar despesas", e);
      }
    }
    void loadDespesas();
  }, [selectedSession, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    async function loadFluxoMensal() {
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/fluxo-mensal?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const j = await res.json();
          setFluxoMensal(j.items || []);
        }
      } catch (e) {
        console.error("Erro ao carregar fluxo mensal", e);
      }
    }

    void loadFluxoMensal();
  }, [selectedSession, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    async function loadInadimplenciaClasse() {
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/inadimplencia-classe?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const j = await res.json();
          setInadimplenciaClasse(j.items || []);
        }
      } catch (e) {
        console.error("Erro ao carregar inadimplência por classe", e);
      }
    }

    void loadInadimplenciaClasse();
  }, [selectedSession, escolaId]);

  const exportCsv = () => {
    const mensalRows = mensalFiltrado.map((row) => ({
      secao: "serie_mensal",
      competencia: row.labelMes,
      mensalidades: row.qtdMensalidades,
      em_atraso: row.qtdEmAtraso,
      pagas_adiantadas: row.qtdPagasAdiantadas,
      parciais: row.qtdParciais,
      total_previsto: row.totalPrevisto,
      total_pago: row.totalPago,
      total_pago_adiantado: row.totalPagoAdiantado,
      total_parcial_em_aberto: row.totalParcialEmAberto,
      total_em_atraso: row.totalEmAtraso,
      inadimplencia_pct: row.inadimplenciaPct.toFixed(1),
    }));

    const turmaRows = porTurma.map((row) => ({
      secao: "ranking_turmas",
      turma: row.turmaNome,
      classe: row.classe ?? "",
      turno: row.turno ?? "",
      mensalidades: row.qtdMensalidades,
      em_atraso: row.qtdEmAtraso,
      pagas_adiantadas: row.qtdPagasAdiantadas,
      parciais: row.qtdParciais,
      total_previsto: row.totalPrevisto,
      total_pago: row.totalPago,
      total_pago_adiantado: row.totalPagoAdiantado,
      total_parcial_em_aberto: row.totalParcialEmAberto,
      total_em_atraso: row.totalEmAtraso,
      inadimplencia_pct: row.inadimplenciaPct.toFixed(1),
    }));

    const fluxoRows = fluxoMensalFiltrado.map((row) => ({
      secao: "fluxo_mensal",
      mes_ref: row.mesRef,
      saldo_anterior: row.saldoAnterior,
      entradas_total: row.entradasTotal,
      saidas_total: row.saidasTotal,
      diferenca: row.diferenca,
      saldo_final: row.saldoFinal,
    }));

    const inadimplenciaRows = inadimplenciaClasseFiltrada.map((row) => ({
      secao: "inadimplencia_classe",
      mes_ref: row.mesRef,
      classe: row.classeLabel,
      qtd_em_atraso: row.qtdEmAtraso,
      valor_unitario_medio: row.valorUnitarioMedio,
      total_em_atraso: row.totalEmAtraso,
      qtd_parciais: row.qtdParciais,
      total_parcial_em_aberto: row.totalParcialEmAberto,
    }));

    const csv = toCsv([...mensalRows, ...turmaRows, ...fluxoRows, ...inadimplenciaRows]);
    downloadText(
      `relatorio_mensalidades_${anoLetivoAtivo}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 print:text-3xl">
              {boardMode ? "Painel Executivo Financeiro" : "Relatório de Mensalidades"}
            </h1>
            {!boardMode && (
              <div className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:flex ${
                healthScore >= 80 ? "bg-emerald-100 text-emerald-700" :
                healthScore >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-rose-100 text-rose-700"
              }`}>
                <Activity className="h-3 w-3" />
                Saúde: {healthScore}%
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 print:text-slate-600">
            {boardMode
              ? "Leitura limpa para diretoria, TV ou tablet, com foco em KPIs e sinais do período."
              : "Resumo imprimível das propinas por período e por turma."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-sm text-slate-600">Sessão</label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setBoardMode((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              boardMode
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {boardMode ? "Sair do modo diretoria" : "Modo diretoria"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {!loading && !error ? (
        <div className="space-y-4">
          <QuickViewTimeline
            months={availableMonths}
            selectedMonth={selectedMonth}
            selectedMonthLabel={selectedMonthLabel}
            onSelectMonth={setSelectedMonth}
            onResetMonth={() => setSelectedMonth("all")}
            formatCurrency={kwanza.format}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ano letivo</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{anoLetivoAtivo}</p>
              <p className="mt-1 text-xs text-slate-500">{resumo.mensalidades} mensalidades no período</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Previsto</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{kwanza.format(resumo.previsto)}</p>
              <p className="mt-1 text-xs text-slate-500">Base total emitida</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Pago</p>
              <p className="mt-2 text-2xl font-bold text-emerald-800">{kwanza.format(resumo.pago)}</p>
              <p className="mt-1 text-xs text-emerald-700">Arrecadação confirmada</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (highlightedDebtMonth !== "all") setSelectedMonth(highlightedDebtMonth);
                document.getElementById("inadimplencia-por-classe")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md print:pointer-events-none print:rounded-xl print:shadow-none"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Em atraso</p>
              <p className="mt-2 text-2xl font-bold text-rose-800">{kwanza.format(resumo.atraso)}</p>
              <p className="mt-1 text-xs text-rose-700">{resumo.emAtraso} mensalidades em incumprimento</p>
              <p className="mt-3 text-[11px] font-semibold text-rose-800">
                Clique para abrir a visão de cobrança {highlightedDebtMonth !== "all" ? `em ${selectedMonthLabel}` : "mais crítica"}
              </p>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-wide text-slate-400">Pagas adiantadas</p>
              <p className="mt-2 text-xl font-bold text-sky-700">{resumo.pagasAdiantadas}</p>
              <p className="mt-1 text-xs text-slate-500">{kwanza.format(resumo.pagoAdiantado)} recebidos antes do vencimento</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-wide text-slate-400">Parciais</p>
              <p className="mt-2 text-xl font-bold text-amber-700">{resumo.parciais}</p>
              <p className="mt-1 text-xs text-slate-500">Pagamentos ainda incompletos</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-wide text-slate-400">Saldo parcial</p>
              <p className="mt-2 text-xl font-bold text-amber-800">{kwanza.format(resumo.parcialEmAberto)}</p>
              <p className="mt-1 text-xs text-slate-500">Montante por liquidar nas parciais</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
              <p className="text-xs uppercase tracking-wide text-slate-400">Taxa de atraso</p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {resumo.taxaAtrasoPct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Sobre o total de mensalidades do período</p>
            </div>
          </div>

          <FinanceInsightsPanel insights={insights} onAction={openInsight} />

          {boardMode ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] print:hidden">
              <BoardExecutivePanel
                financialInsights={financialInsights}
                formatCurrency={kwanza.format}
                healthScore={healthScore}
                saldoFinalResultado={saldoFinalResultado}
                selectedMonthLabel={selectedMonthLabel}
                totalEntradasResultado={totalEntradasResultado}
                totalSaidasResultado={totalSaidasResultado}
                totalAtraso={resumo.atraso}
                renderInsights={<FinancialHealthInsightsPanel insights={financialInsights} />}
              />

              <BoardPressurePanel
                diamondTurmas={diamondTurmas}
                executiveHighlights={executiveHighlights}
                formatCurrency={kwanza.format}
                totalAtraso={resumo.atraso}
              />
            </div>
          ) : null}

          {!boardMode ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2">
            {/* Bloco de Captação Acadêmica */}
            <div
              id="despesas-operacionais"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none"
            >
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Captação por Classe</h2>
                  <p className="text-xs text-slate-500">Matrículas e confirmações efetuadas no ano.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm print:text-[10px]">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">Classe</th>
                      <th className="py-2 pr-4 text-right">Matrículas</th>
                      <th className="py-2 pr-4 text-right">Confirmações</th>
                      <th className="py-2 pr-0 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {captacao.map((c) => (
                      <tr key={c.label} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{c.label}</td>
                        <td className="py-2 pr-4 text-right">{c.matriculas}</td>
                        <td className="py-2 pr-4 text-right">{c.confirmacoes}</td>
                        <td className="py-2 pr-0 text-right font-bold">{c.total}</td>
                      </tr>
                    ))}
                    {captacao.length === 0 ? (
                      <EducationalEmptyState
                        colSpan={4}
                        title="Captação ainda não lançada"
                        message="Parece que você ainda não registrou matrículas e confirmações deste período. Lance agora para abrir a leitura comercial."
                        ctaHref={`/escola/${escolaId}/secretaria`}
                        ctaLabel="Lancar agora"
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloco de Bolsistas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Inscritos e Bolsistas</h2>
                  <p className="text-xs text-slate-500">Resumo de alunos com benefícios ou descontos.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm print:text-[10px]">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">Classe</th>
                      <th className="py-2 pr-4 text-right">Alunos</th>
                      <th className="py-2 pr-4 text-right">Bolsistas</th>
                      <th className="py-2 pr-0 text-right">% Bolsistas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {captacao.map((c) => (
                      <tr key={`${c.label}-bolsas`} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{c.label}</td>
                        <td className="py-2 pr-4 text-right">{c.total}</td>
                        <td className="py-2 pr-4 text-right text-blue-600 font-medium">{c.bolsistas}</td>
                        <td className="py-2 pr-0 text-right">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {c.total > 0 ? ((c.bolsistas / c.total) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {captacao.length === 0 ? (
                      <EducationalEmptyState
                        colSpan={4}
                        title="Ainda nao ha dados institucionais"
                        message="Sem inscritos e bolsistas registrados, a diretoria perde visibilidade de acesso e bolsas. Atualize este bloco."
                        ctaHref={`/escola/${escolaId}/secretaria`}
                        ctaLabel="Atualizar agora"
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          ) : null}

          {!boardMode ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2">
            {/* Bloco de Despesas (Saídas) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Saídas e Despesas</h2>
                  <p className="text-xs text-slate-500">Resumo de débitos registrados no ledger.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Despesas</p>
                  <p className="text-lg font-bold text-rose-600">{kwanza.format(totalDespesas)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm print:text-[10px]">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">Categoria / Evento</th>
                      <th className="py-2 pr-4 text-right">Qtd</th>
                      <th className="py-2 pr-0 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d) => (
                      <tr key={d.label} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{d.label}</td>
                        <td className="py-2 pr-4 text-right text-slate-500">{d.qtd}</td>
                        <td className="py-2 pr-0 text-right font-bold text-rose-600">{kwanza.format(d.total)}</td>
                      </tr>
                    ))}
                    {despesas.length === 0 ? (
                      <EducationalEmptyState
                        colSpan={3}
                        title="Despesas ainda nao lancadas"
                        message="Parece que voce ainda nao lancou as despesas deste mes. Lance agora para fechar o saldo com seguranca."
                        ctaHref={`/escola/${escolaId}/secretaria`}
                        ctaLabel="Lancar agora"
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloco de Resultado Financeiro (Resumo Geral) */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-emerald-300 print:p-0 print:shadow-none">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-emerald-900">Resultado do Período</h2>
                <p className="text-xs text-emerald-700">Balanço entre arrecadação (propinas) e despesas.</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-sm text-emerald-800">Total Entradas</span>
                  <span className="font-bold text-emerald-700">{kwanza.format(totalEntradasResultado)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-sm text-rose-800">Total Saídas (Despesas)</span>
                  <span className="font-bold text-rose-700">-{kwanza.format(totalSaidasResultado)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-bold text-slate-900">Saldo Final</span>
                  <span className={`text-xl font-black ${saldoFinalResultado >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {kwanza.format(saldoFinalResultado)}
                  </span>
                </div>

                <div className="mt-6 rounded-xl bg-white/60 p-3 border border-emerald-100 print:hidden">
                  <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Informação de Gestão</p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Este balanço considera apenas as receitas de propinas pagas e as despesas registradas no sistema. 
                    Para um fluxo de caixa completo (incluindo vendas, taxas e emolumentos), consulte o relatório de Fluxo de Caixa.
                  </p>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none">
          Carregando relatório...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 print:rounded-none print:border-none print:bg-transparent print:p-0">
          {error}
        </div>
      ) : null}

      {!loading && !error && !boardMode ? (
        <>
          <div
            id="ranking-por-turma"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none"
          >
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Série mensal ({anoLetivoAtivo})</h2>
                <p className="text-xs text-slate-500">Leitura por competência, com foco em arrecadação, adiantamentos e saldo pendente.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Competência</th>
                    <th className="py-2 pr-4 text-right">Mensalidades</th>
                    <th className="py-2 pr-4 text-right">Em atraso</th>
                    <th className="py-2 pr-4 text-right">Adiantadas</th>
                    <th className="py-2 pr-4 text-right">Parciais</th>
                    <th className="py-2 pr-4 text-right">Previsto</th>
                    <th className="py-2 pr-4 text-right">Pago</th>
                    <th className="py-2 pr-4 text-right">Pago adiantado</th>
                    <th className="py-2 pr-4 text-right">Saldo parcial</th>
                    <th className="py-2 pr-4 text-right">Atraso</th>
                    <th className="py-2 pr-0 text-right">Inadimplência</th>
                  </tr>
                </thead>
                <tbody>
                  {mensalFiltrado.map((m) => (
                    <tr key={`${m.ano}-${m.mes}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{m.labelMes}</td>
                      <td className="py-2 pr-4 text-right">{m.qtdMensalidades}</td>
                      <td className="py-2 pr-4 text-right">{m.qtdEmAtraso}</td>
                      <td className="py-2 pr-4 text-right">{m.qtdPagasAdiantadas}</td>
                      <td className="py-2 pr-4 text-right">{m.qtdParciais}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(m.totalPrevisto)}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(m.totalPago)}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(m.totalPagoAdiantado)}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(m.totalParcialEmAberto)}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(m.totalEmAtraso)}</td>
                      <td className="py-2 pr-0 text-right">{m.inadimplenciaPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {mensalFiltrado.length === 0 ? (
                    <EducationalEmptyState
                      colSpan={11}
                      title="Nenhuma competencia encontrada"
                      message={`Nao ha dados para ${selectedMonthLabel.toLowerCase()}. Verifique se as mensalidades deste recorte ja foram processadas.`}
                      ctaHref={`/escola/${escolaId}/secretaria`}
                      ctaLabel="Revisar lancamentos"
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div
            id="fluxo-mensal"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none"
          >
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ranking por turma ({anoLetivoAtivo})</h2>
                <p className="text-xs text-slate-500">Ordenado por maior atraso, com visibilidade de adiantamentos e pagamentos parciais.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Turma</th>
                    <th className="py-2 pr-4">Classe</th>
                    <th className="py-2 pr-4">Turno</th>
                    <th className="py-2 pr-4 text-right">Mensalidades</th>
                    <th className="py-2 pr-4 text-right">Pagas (Alunos)</th>
                    <th className="py-2 pr-4 text-right">Em atraso</th>
                    <th className="py-2 pr-4 text-right">Adiantadas</th>
                    <th className="py-2 pr-4 text-right">Parciais (Metade)</th>
                    <th className="py-2 pr-4 text-right">Pago (Arrecadado)</th>
                    <th className="py-2 pr-4 text-right">Atraso (Valor)</th>
                    <th className="py-2 pr-4 text-right">Pend. Parcial</th>
                    <th className="py-2 pr-0 text-right">Inadimplência</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingTurmasOrdenado.map((t) => (
                    <tr key={t.turmaId} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">{t.turmaNome}</td>
                      <td className="py-2 pr-4">{t.classe || "—"}</td>
                      <td className="py-2 pr-4">{t.turno || "—"}</td>
                      <td className="py-2 pr-4 text-right">{t.qtdMensalidades}</td>
                      <td className="py-2 pr-4 text-right text-emerald-600 font-semibold">
                        {t.qtdMensalidades - t.qtdEmAtraso - t.qtdParciais}
                      </td>
                      <td className="py-2 pr-4 text-right text-rose-600">{t.qtdEmAtraso}</td>
                      <td className="py-2 pr-4 text-right text-sky-600">{t.qtdPagasAdiantadas}</td>
                      <td className="py-2 pr-4 text-right text-amber-600 font-medium">
                        {t.qtdParciais}
                      </td>
                      <td className="py-2 pr-4 text-right text-emerald-700 font-bold">
                        {kwanza.format(t.totalPago + t.totalPagoAdiantado)}
                      </td>
                      <td className="py-2 pr-4 text-right text-rose-700">
                        {kwanza.format(t.totalEmAtraso)}
                      </td>
                      <td className="py-2 pr-4 text-right text-amber-700">
                        {kwanza.format(t.totalParcialEmAberto)}
                      </td>
                      <td className="py-2 pr-0 text-right font-medium">{t.inadimplenciaPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {porTurma.length === 0 ? (
                    <EducationalEmptyState
                      colSpan={11}
                      title="Ranking por turma indisponivel"
                      message="Ainda nao ha massa critica para comparar turmas. Registre os movimentos financeiros e volte a este painel."
                      ctaHref={`/escola/${escolaId}/secretaria`}
                      ctaLabel="Ver secretaria"
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Fluxo mensal ({anoLetivoAtivo})</h2>
                <p className="text-xs text-slate-500">Saldo anterior, entradas, saídas e saldo final por competência.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 pr-4 text-right">Saldo anterior</th>
                    <th className="py-2 pr-4 text-right">Entradas</th>
                    <th className="py-2 pr-4 text-right">Saídas</th>
                    <th className="py-2 pr-4 text-right">Diferença</th>
                    <th className="py-2 pr-0 text-right">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxoMensalFiltrado.map((item) => (
                    <tr key={item.mesRef} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{new Date(`${item.mesRef}T00:00:00`).toLocaleDateString("pt-PT", { month: "2-digit", year: "numeric" })}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(item.saldoAnterior)}</td>
                      <td className="py-2 pr-4 text-right text-emerald-700">{kwanza.format(item.entradasTotal)}</td>
                      <td className="py-2 pr-4 text-right text-rose-700">{kwanza.format(item.saidasTotal)}</td>
                      <td className={`py-2 pr-4 text-right font-medium ${item.diferenca >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{kwanza.format(item.diferenca)}</td>
                      <td className={`py-2 pr-0 text-right font-bold ${item.saldoFinal >= 0 ? "text-slate-900" : "text-rose-800"}`}>{kwanza.format(item.saldoFinal)}</td>
                    </tr>
                  ))}
                  {fluxoMensalFiltrado.length === 0 ? (
                    <EducationalEmptyState
                      colSpan={6}
                      title="Fluxo mensal indisponivel"
                      message="Sem entradas e saidas consolidadas, o fechamento desta competencia fica incompleto. Lance os movimentos para preencher este quadro."
                      ctaHref={`/escola/${escolaId}/secretaria`}
                      ctaLabel="Atualizar fluxo"
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div
            id="inadimplencia-por-classe"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-slate-300 print:p-0 print:shadow-none"
          >
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Inadimplência por classe ({anoLetivoAtivo})</h2>
                <p className="text-xs text-slate-500">Propinas em atraso e saldos parciais agrupados por classe e mês.</p>
              </div>
              {selectedMonth !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSelectedMonth("all")}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Limpar filtro de mês
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 pr-4">Classe</th>
                    <th className="py-2 pr-4 text-right">Qtd atraso</th>
                    <th className="py-2 pr-4 text-right">Valor unit. médio</th>
                    <th className="py-2 pr-4 text-right">Total em atraso</th>
                    <th className="py-2 pr-4 text-right">Parciais</th>
                    <th className="py-2 pr-0 text-right">Saldo parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplenciaClasseFiltrada.map((item) => (
                    <tr key={`${item.mesRef}-${item.classeId}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{new Date(`${item.mesRef}T00:00:00`).toLocaleDateString("pt-PT", { month: "2-digit", year: "numeric" })}</td>
                      <td className="py-2 pr-4 font-medium">{item.classeLabel}</td>
                      <td className="py-2 pr-4 text-right">{item.qtdEmAtraso}</td>
                      <td className="py-2 pr-4 text-right">{kwanza.format(item.valorUnitarioMedio)}</td>
                      <td className="py-2 pr-4 text-right font-bold text-rose-700">{kwanza.format(item.totalEmAtraso)}</td>
                      <td className="py-2 pr-4 text-right">{item.qtdParciais}</td>
                      <td className="py-2 pr-0 text-right text-amber-700">{kwanza.format(item.totalParcialEmAberto)}</td>
                    </tr>
                  ))}
                  {inadimplenciaClasseFiltrada.length === 0 ? (
                    <EducationalEmptyState
                      colSpan={7}
                      title="Nenhum devedor encontrado neste recorte"
                      message="Quando houver alunos em atraso, esta tabela vira sua fila operacional de cobranca. Ajuste o mes acima ou acompanhe o proximo fechamento."
                      ctaHref={`/escola/${escolaId}/secretaria`}
                      ctaLabel="Voltar para secretaria"
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
