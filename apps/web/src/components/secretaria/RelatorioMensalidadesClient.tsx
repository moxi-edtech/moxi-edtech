"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useFinanceInsights } from "@/hooks/useFinanceInsights";
import { useFinancialHealthInsights } from "@/hooks/useFinancialHealthInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import * as XLSX from "xlsx";

// Subcomponentes locais
import { RelatorioHeader } from "./relatorio-financeiro/RelatorioHeader";
import { TabResumo } from "./relatorio-financeiro/TabResumo";
import { TabCaptacao } from "./relatorio-financeiro/TabCaptacao";
import { TabPropinas } from "./relatorio-financeiro/TabPropinas";
import { TabFluxo } from "./relatorio-financeiro/TabFluxo";
import { RecoveryCalculator } from "./relatorio-financeiro/RecoveryCalculator";
import { 
  Mensal, 
  PorTurma, 
  CaptacaoItem, 
  DespesaItem, 
  SessionItem, 
  ResumoFinanceiro, 
  FluxoMensalItem, 
  InadimplenciaClasseItem 
} from "./relatorio-financeiro/types";
import { kwanza, normalizeMonthKey } from "./relatorio-financeiro/utils";

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
  const [activeTab, setActiveTab] = useState("resumo");

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
    const formatMonthRef = (value: string) => {
      return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
        month: "short",
        year: "2-digit",
      });
    };

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

  const prevResumo = useMemo<ResumoFinanceiro | null>(() => {
    if (selectedMonth === "all") return null;
    const currentIndex = availableMonths.findIndex((m) => m.key === selectedMonth);
    if (currentIndex <= 0) return null;

    const prevMonthKey = availableMonths[currentIndex - 1].key;
    const prevMonthData = serieMensalOrdenada.filter(
      (row) => `${row.ano}-${String(row.mes).padStart(2, "0")}` === prevMonthKey
    );

    if (prevMonthData.length === 0) return null;

    return prevMonthData.reduce(
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
        despesasTotal: 0,
        entradasTotal: 0,
        saldoAnterior: 0,
        saldoPeriodo: 0,
        saldoAcumulado: 0,
        taxaAtrasoPct: 0,
      }
    );
  }, [availableMonths, selectedMonth, serieMensalOrdenada]);

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

  const handleOpenInsight = (targetId: string, monthKey?: string) => {
    if (monthKey) {
      setSelectedMonth(monthKey);
    }

    // Mapear targetId para Tab
    if (targetId.includes("inadimplencia")) {
      setActiveTab("propinas");
    } else if (targetId.includes("despesas") || targetId.includes("fluxo")) {
      setActiveTab("fluxo");
    } else if (targetId.includes("captacao")) {
      setActiveTab("captacao");
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

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/financeiro/relatorios/escolar/full?ano_letivo_id=${encodeURIComponent(selectedSession)}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || `Erro ${res.status}`);
        }
        
        const json = await res.json();
        
        if (!cancelled) {
          setResumoFinanceiro(json.resumo || null);
          setMensal(json.mensal || []);
          setPorTurma(json.porTurma || []);
          setCaptacao(json.captacao || []);
          setDespesas(json.despesas || []);
          setTotalDespesas(json.totalDespesas || 0);
          setFluxoMensal(json.fluxoMensal || []);
          setInadimplenciaClasse(json.inadimplenciaClasse || []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar relatório consolidado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [selectedSession, escolaId]);

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
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio_mensalidades_${anoLetivoAtivo}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
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
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio_mensalidades.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const toCsv = (rows: Array<Record<string, string | number | null | undefined>>) => {
      if (rows.length === 0) return "";
      const headers = Object.keys(rows[0]);
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      return [
        headers.map(escape).join(","),
        ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
      ].join("\n");
    };

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

    const csv = toCsv([...mensalRows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio_mensalidades_${anoLetivoAtivo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <RelatorioHeader
        boardMode={boardMode}
        setBoardMode={setBoardMode}
        healthScore={healthScore}
        sessions={sessions}
        selectedSession={selectedSession}
        setSelectedSession={setSelectedSession}
        onPrint={() => window.print()}
        onExportCsv={exportCsv}
        onExportExcel={exportExcel}
        onExportPdf={exportPdf}
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 print:rounded-none print:border-none print:bg-transparent print:p-0">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none">
          Carregando relatório...
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="captacao">Captação</TabsTrigger>
            <TabsTrigger value="propinas">Propinas</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-6">
            <TabResumo
              availableMonths={availableMonths}
              selectedMonth={selectedMonth}
              selectedMonthLabel={selectedMonthLabel}
              setSelectedMonth={setSelectedMonth}
              resumo={resumo}
              prevResumo={prevResumo}
              anoLetivoAtivo={anoLetivoAtivo}
              highlightedDebtMonth={highlightedDebtMonth}
              onOpenInsight={handleOpenInsight}
              insights={insights}
              boardMode={boardMode}
              financialInsights={financialInsights}
              healthScore={healthScore}
              totalEntradasResultado={totalEntradasResultado}
              totalSaidasResultado={totalSaidasResultado}
              saldoFinalResultado={saldoFinalResultado}
              diamondTurmas={diamondTurmas}
              executiveHighlights={executiveHighlights}
            />
          </TabsContent>

          <TabsContent value="captacao" className="mt-6">
            <TabCaptacao
              captacao={captacao}
              escolaId={escolaId}
              anoLetivoAtivo={anoLetivoAtivo}
              anoLetivoId={selectedSession}
            />
          </TabsContent>

          <TabsContent value="propinas" className="mt-6">
            <TabPropinas
              mensalFiltrado={mensalFiltrado}
              rankingTurmasOrdenado={rankingTurmasOrdenado}
              inadimplenciaClasseFiltrada={inadimplenciaClasseFiltrada}
              selectedMonth={selectedMonth}
              selectedMonthLabel={selectedMonthLabel}
              setSelectedMonth={setSelectedMonth}
              anoLetivoAtivo={anoLetivoAtivo}
              anoLetivoId={selectedSession}
              escolaId={escolaId}
            />
          </TabsContent>

          <TabsContent value="fluxo" className="mt-6">
            <TabFluxo
              despesas={despesas}
              totalDespesas={totalDespesas}
              totalEntradasResultado={totalEntradasResultado}
              totalSaidasResultado={totalSaidasResultado}
              saldoFinalResultado={saldoFinalResultado}
              fluxoMensalFiltrado={fluxoMensalFiltrado}
              anoLetivoAtivo={anoLetivoAtivo}
              escolaId={escolaId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
