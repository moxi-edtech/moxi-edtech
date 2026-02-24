"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Save, WifiOff, Printer, FileDown } from "lucide-react";
import { SchedulerBoard } from "@/components/escola/horarios/SchedulerBoard";
import { DisciplinaModal, type DisciplinaForm } from "@/components/escola/settings/_components/DisciplinaModal";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { useHorarioBaseData, useHorarioTurmaData } from "@/hooks/useHorarioData";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { pdf } from "@react-pdf/renderer";
import { QuadroHorarioPdf } from "@/templates/pdf/horarios/QuadroHorario";
import { useToast } from "@/components/feedback/FeedbackSystem";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

export default function QuadroHorariosPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const { online } = useOfflineStatus();
  const { success, error, warning, toast: rawToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [clearingQuadro, setClearingQuadro] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const [novaSala, setNovaSala] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [baseRefreshToken, setBaseRefreshToken] = useState(0);
  const [adjustingSlots, setAdjustingSlots] = useState(false);
  const [generatingContraturno, setGeneratingContraturno] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string>("");
  const [curriculoModalOpen, setCurriculoModalOpen] = useState(false);
  const [curriculoDisciplinas, setCurriculoDisciplinas] = useState<
    Array<{
      id: string;
      nome: string;
      codigo: string;
      carga_horaria_semanal: number;
      base_weekly_hours?: number | null;
      classificacao?: "core" | "complementar" | "optativa" | null;
      periodos_ativos?: number[] | null;
      entra_no_horario?: boolean | null;
      avaliacao_mode_key?: "inherit_school" | "custom" | "inherit_disciplina" | null;
      avaliacao_disciplina_id?: string | null;
      area?: string | null;
      is_core?: boolean | null;
      matrix_ids: string[];
      class_ids?: string[];
      matrix_by_class?: Record<string, string[]>;
    }>
  >([]);
  const [curriculoClasses, setCurriculoClasses] = useState<Array<{ id: string; nome: string }>>([]);
  const [curriculoSelectedId, setCurriculoSelectedId] = useState<string | null>(null);
  const [professores, setProfessores] = useState<Array<{ id: string; nome: string }>>([]);

  const {
    slots,
    slotLookup,
    salas,
    turmas,
    loading: baseLoading,
    error: baseError,
    setSalas,
    setTurmas,
  } = useHorarioBaseData(escolaId, baseRefreshToken);

  const {
    aulas,
    grid,
    existingAssignments,
    loading: turmaLoading,
    error: turmaError,
    setAulas,
    setGrid,
  } = useHorarioTurmaData({ escolaId, turmaId, versaoId, slotLookup, refreshToken });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    fetch(`/api/escolas/${escolaId}/nome`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.ok && json?.nome) setEscolaNome(json.nome);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    let active = true;
    fetch("/api/secretaria/professores?pageSize=200")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.ok && Array.isArray(json.items)) {
          setProfessores(
            json.items
              .map((item: any) => ({ id: item.user_id ?? item.id, nome: item.nome ?? "Professor" }))
              .filter((item: any) => Boolean(item.id))
          );
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!escolaId) return;
    const key = `horarios:versao:${escolaId}`;
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (stored) {
      setVersaoId(stored);
      return;
    }
    const next = crypto.randomUUID();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(key, next);
    }
    setVersaoId(next);
  }, [escolaId]);

  useEffect(() => {
    if (turmas.length === 0) {
      setTurmaId(null);
      return;
    }
    setTurmaId((prev) => {
      if (prev && turmas.some((turma) => turma.id === prev)) return prev;
      return turmas[0]?.id ?? null;
    });
  }, [turmas]);

  useEffect(() => {
    const targetCursoId = turmas.find((turma) => turma.id === turmaId)?.curso_id;
    if (!curriculoModalOpen || !targetCursoId || !escolaId) return;
    let active = true;
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const parseClassNumber = (value: string) => {
      const match = value.match(/(\d{1,2})/);
      return match ? Number(match[1]) : null;
    };

    Promise.all([
      fetch(`/api/escolas/${escolaId}/disciplinas?curso_id=${targetCursoId}&limit=500`, {
        cache: "force-cache",
      }).then((res) => res.json()),
      fetch(`/api/escolas/${escolaId}/curriculo/padroes?curso_id=${targetCursoId}`, {
        cache: "force-cache",
      }).then((res) => res.json()),
    ])
      .then(([disciplinasJson, padroesJson]) => {
        if (!active) return;
        const rows = Array.isArray(disciplinasJson?.data) ? disciplinasJson.data : [];
        const presetMap = new Map<string, number>();
        const presetItems = Array.isArray(padroesJson?.items) ? padroesJson.items : [];
        for (const item of presetItems) {
          const classNum = parseClassNumber(item.grade_level ?? "");
          if (!classNum) continue;
          const key = `${classNum}:${normalize(item.name ?? "")}`;
          presetMap.set(key, Number(item.weekly_hours) || 0);
        }

        const classMap = new Map<string, string>();
        rows.forEach((row: any) => {
          if (row.classe_id) {
            classMap.set(row.classe_id, row.classe_nome ?? row.classe_id);
          }
        });
        const classes = Array.from(classMap.entries()).map(([id, nome]) => ({ id, nome }));

        const disciplinaGroups = new Map<string, any[]>();
        rows.forEach((item: any) => {
          const key = item.disciplina_id ?? item.nome ?? item.id;
          const bucket = disciplinaGroups.get(key) ?? [];
          bucket.push(item);
          disciplinaGroups.set(key, bucket);
        });

        const disciplinaList: typeof curriculoDisciplinas = [];
        disciplinaGroups.forEach((items) => {
          const primary = items[0];
          const matrixIds = items.map((item: any) => item.id).filter(Boolean);
          const classIds = items.map((item: any) => item.classe_id).filter(Boolean);
          const matrixByClass: Record<string, string[]> = {};
          items.forEach((item: any) => {
            if (!item.classe_id || !item.id) return;
            matrixByClass[item.classe_id] = matrixByClass[item.classe_id] || [];
            matrixByClass[item.classe_id].push(item.id);
          });
          const classNum = parseClassNumber(primary.classe_nome ?? "");
          const baseKey = classNum ? `${classNum}:${normalize(primary.nome ?? "")}` : null;
          const baseWeeklyHours = baseKey ? presetMap.get(baseKey) ?? null : null;
          disciplinaList.push({
            id: primary.disciplina_id ?? primary.id,
            nome: primary.nome ?? "Disciplina",
            codigo: primary.sigla ?? primary.codigo ?? "",
            carga_horaria_semanal: primary.carga_horaria_semanal ?? 0,
            base_weekly_hours: baseWeeklyHours,
            classificacao: primary.classificacao ?? null,
            periodos_ativos: primary.periodos_ativos ?? null,
            entra_no_horario: primary.entra_no_horario ?? true,
            avaliacao_mode_key: primary.avaliacao_mode ?? null,
            avaliacao_disciplina_id: primary.avaliacao_disciplina_id ?? null,
            area: primary.area ?? null,
            is_core: primary.is_core ?? null,
            matrix_ids: matrixIds,
            class_ids: classIds,
            matrix_by_class: matrixByClass,
          });
        });

        disciplinaList.sort((a, b) => a.nome.localeCompare(b.nome));
        setCurriculoClasses(classes);
        setCurriculoDisciplinas(disciplinaList);
        setCurriculoSelectedId((prev) => {
          if (prev && disciplinaList.some((disc) => disc.id === prev)) return prev;
          return disciplinaList[0]?.id ?? null;
        });
      })
      .catch(() => null)
      .finally(() => {
        if (!active) return;
      });
    return () => {
      active = false;
    };
  }, [curriculoModalOpen, escolaId, turmaId, turmas]);

  const turmaOptions = useMemo(() => {
    if (turmas.length === 0) {
      return [{ value: "", label: "Sem turmas" }];
    }
    return [
      { value: "", label: "Selecione uma turma" },
      ...turmas.map((turma) => ({
        value: turma.id,
        label:
          turma.turma_codigo ||
          turma.turma_code ||
          turma.turma_nome ||
          turma.nome ||
          turma.id,
      })),
    ];
  }, [turmas]);

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === turmaId) || null,
    [turmaId, turmas]
  );

  const aulasWithAllocations = useMemo(() => {
    if (!aulas.length) return [];
    const counts: Record<string, number> = {};
    for (const value of Object.values(grid)) {
      if (!value) continue;
      counts[value] = (counts[value] || 0) + 1;
    }
    return aulas.map((aula) => ({
      ...aula,
      temposAlocados: counts[aula.id] ?? 0,
    }));
  }, [aulas, grid]);

  const horariosDisponiveis = useMemo(() => (slots.length > 0 ? slots : undefined), [slots]);
  const missingLoad = useMemo(() => aulasWithAllocations.filter((aula) => aula.missingLoad), [aulasWithAllocations]);
  const missingLoadCount = missingLoad.length;
  const canPublicar = missingLoadCount === 0;
  const isLoading = baseLoading || turmaLoading;
  const showOfflineStatus = isMounted && !online;
  const totalDias = useMemo(() => {
    const unique = new Set(Object.keys(slotLookup).map((key) => key.split("-")[0]));
    return unique.size || 5;
  }, [slotLookup]);
  const temposAulaCount = useMemo(
    () => (horariosDisponiveis ?? []).filter((slot) => slot.tipo !== "intervalo").length,
    [horariosDisponiveis]
  );
  const totalSlots = totalDias * temposAulaCount;
  const filledSlots = useMemo(
    () => Object.values(grid).filter((value) => Boolean(value)).length,
    [grid]
  );
  const totalCarga = useMemo(
    () => aulasWithAllocations.reduce((acc, aula) => acc + (aula.temposTotal || 0), 0),
    [aulasWithAllocations]
  );
  const excessoCarga = Math.max(0, totalCarga - totalSlots);
  const turnoLabel = useMemo(() => {
    const turno = selectedTurma?.turno?.toString().toUpperCase() ?? "";
    if (turno === "M") return "manhã";
    if (turno === "T") return "tarde";
    if (turno === "N") return "noite";
    return "turno";
  }, [selectedTurma?.turno]);
  const disciplinasCompletas = useMemo(
    () => aulasWithAllocations.filter((aula) => !aula.missingLoad && aula.temposTotal > 0 && aula.temposAlocados >= aula.temposTotal).length,
    [aulasWithAllocations]
  );
  const disciplinasPendentes = useMemo(
    () =>
      aulasWithAllocations.filter(
        (aula) => aula.missingLoad || (aula.temposTotal > 0 && aula.temposAlocados < aula.temposTotal)
      ),
    [aulasWithAllocations]
  );
  const conflitosCount = Object.keys(conflictSlots).length;
  const professorLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulasWithAllocations) {
      if (!aula.professorId) continue;
      const entry = map.get(aula.professorId) || {
        id: aula.professorId,
        nome: aula.professor || "Professor",
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.professorId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulasWithAllocations]);
  const salaLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulasWithAllocations) {
      if (!aula.salaId) continue;
      const sala = salas.find((item) => item.id === aula.salaId);
      const entry = map.get(aula.salaId) || {
        id: aula.salaId,
        nome: sala?.nome ?? `Sala ${aula.salaId.slice(0, 4)}`,
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.salaId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulasWithAllocations, salas]);
  const overloadProfessores = professorLoad.filter((item) => item.count >= 16);
  const overloadSalas = salaLoad.filter((item) => item.count >= 20);

  const mapTurnoId = (turno?: string | null) => {
    const normalized = turno?.toString().toUpperCase();
    if (normalized === "M") return "matinal";
    if (normalized === "T") return "tarde";
    if (normalized === "N") return "noite";
    return "matinal";
  };

  const targetSlotsPerDay = useMemo(() => {
    if (totalDias <= 0) return temposAulaCount;
    return Math.max(temposAulaCount, Math.ceil(totalCarga / totalDias));
  }, [totalCarga, totalDias, temposAulaCount]);

  const handleAutoAdjustSlots = async () => {
    if (!escolaId || !selectedTurma) return;
    if (targetSlotsPerDay <= temposAulaCount) return;
    try {
      setAdjustingSlots(true);
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`);
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao carregar slots.");
      }

      const slots = Array.isArray(json?.items) ? json.items : [];
      const turnoId = mapTurnoId(selectedTurma.turno ?? "M");
      const slotsDoTurno = slots.filter((slot: any) => slot.turno_id === turnoId);
      const slotsByDay = new Map<number, any[]>();
      slotsDoTurno.forEach((slot: any) => {
        const dia = Number(slot.dia_semana);
        if (!slotsByDay.has(dia)) slotsByDay.set(dia, []);
        slotsByDay.get(dia)!.push(slot);
      });

      const newSlots: Array<{
        turno_id: string;
        dia_semana: number;
        ordem: number;
        inicio: string;
        fim: string;
        is_intervalo: boolean;
      }> = [];

      slotsByDay.forEach((daySlots, day) => {
        const sorted = [...daySlots].sort((a, b) => a.ordem - b.ordem);
        const aulasExistentes = sorted.filter((slot) => !slot.is_intervalo).length;
        if (aulasExistentes >= targetSlotsPerDay) return;
        const lastSlot = sorted[sorted.length - 1];
        const [startH, startM] = String(lastSlot.inicio).split(":").map(Number);
        const [endH, endM] = String(lastSlot.fim).split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const duration = Math.max(30, endMinutes - startMinutes);
        let currentEnd = endMinutes;
        let currentOrder = Number(lastSlot.ordem);
        let remaining = targetSlotsPerDay - aulasExistentes;

        while (remaining > 0) {
          currentOrder += 1;
          const nextStart = currentEnd;
          const nextEnd = currentEnd + duration;
          const pad = (value: number) => String(value).padStart(2, "0");
          const inicio = `${pad(Math.floor(nextStart / 60))}:${pad(nextStart % 60)}`;
          const fim = `${pad(Math.floor(nextEnd / 60))}:${pad(nextEnd % 60)}`;
          newSlots.push({
            turno_id: turnoId,
            dia_semana: day,
            ordem: currentOrder,
            inicio,
            fim,
            is_intervalo: false,
          });
          currentEnd = nextEnd;
          remaining -= 1;
        }
      });

      if (newSlots.length === 0) {
        rawToast({ variant: "info", title: "Slots já estão no limite." });
        return;
      }

      const saveRes = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: newSlots }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok || saveJson?.ok === false) {
        throw new Error(saveJson?.error || "Falha ao salvar slots.");
      }

      success(`Slots ajustados para ${targetSlotsPerDay} aulas/dia.`);
      setBaseRefreshToken((prev) => prev + 1);
    } catch (e: any) {
      error(e?.message || "Falha ao ajustar slots.");
    } finally {
      setAdjustingSlots(false);
    }
  };

  const handleAddContraturno = async () => {
    if (!escolaId || !selectedTurma?.curso_id || !selectedTurma?.classe_id) return;
    const anoLetivo = selectedTurma.ano_letivo ?? new Date().getFullYear();
    try {
      setGeneratingContraturno(true);
      const res = await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: selectedTurma.curso_id,
          anoLetivo,
          turnos: ["T"],
          classes: [{ classeId: selectedTurma.classe_id, quantidade: 1 }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao gerar turmas no contraturno.");
      }
      success("Turma de contraturno gerada.");
      setBaseRefreshToken((prev) => prev + 1);
    } catch (e: any) {
      error(e?.message || "Falha ao gerar contraturno.");
    } finally {
      setGeneratingContraturno(false);
    }
  };

  const handleClearQuadro = async () => {
    if (!escolaId || !turmaId || !versaoId) return;
    if (!window.confirm("Limpar o quadro desta turma? Essa ação não pode ser desfeita.")) return;
    try {
      setClearingQuadro(true);
      const res = await fetch(
        `/api/escolas/${escolaId}/horarios/quadro?versao_id=${versaoId}&turma_id=${turmaId}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao limpar o quadro.");
      }
      setGrid({});
      setAulas((prev) => prev.map((aula) => ({ ...aula, temposAlocados: 0 })));
      setRefreshToken((prev) => prev + 1);
      success("Quadro limpo com sucesso.");
    } catch (e: any) {
      error(e?.message || "Falha ao limpar o quadro.");
    } finally {
      setClearingQuadro(false);
    }
  };

  const buildGridRows = () => {
    const rows: Array<{ tempo: string; values: string[] }> = [];
    const tempoLabels = (horariosDisponiveis ?? []).map((slot) => slot.label);
    const sortedTempos = (horariosDisponiveis ?? []).map((slot) => slot.id);
    const aulaById = new Map(aulas.map((aula) => [aula.id, aula]));

    sortedTempos.forEach((tempoId, index) => {
      const label = tempoLabels[index] ?? tempoId;
      const values = DIAS_SEMANA.map((dia) => {
        const key = `${dia}-${tempoId}`;
        const disciplinaId = grid[key];
        if (!disciplinaId) return "";
        const aula = aulaById.get(disciplinaId);
        return aula?.sigla || aula?.disciplina || "";
      });
      rows.push({ tempo: label, values });
    });

    return rows;
  };

  const handleDownloadPdf = async () => {
    if (!selectedTurma || !horariosDisponiveis || horariosDisponiveis.length === 0) {
      error("Selecione uma turma e configure os horários.");
      return;
    }

    try {
      setDownloadingPdf(true);
      const rows = buildGridRows();
      const payload = {
        escola: escolaNome || "Escola",
        curso: selectedTurma?.curso?.nome ?? "Curso",
        classe: selectedTurma?.classe?.nome ?? "Classe",
        turma: selectedTurma?.turma_codigo || selectedTurma?.turma_nome || selectedTurma?.nome || "Turma",
        turno: turnoLabel,
        sala: selectedTurma?.sala ?? null,
        anoLetivo: selectedTurma?.ano_letivo ?? null,
        dias: DIAS_SEMANA,
        tempos: rows.map((row) => row.tempo),
        grid: rows.map((row) => row.values),
        generatedAt: new Date().toLocaleString("pt-PT"),
      };

      const blob = await pdf(<QuadroHorarioPdf {...payload} />).toBlob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const salaSuffix = payload.sala ? `_Sala-${payload.sala.replace(/\s+/g, "-")}` : "";
      link.download = `Horario_${payload.turma}${salaSuffix}_${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      error(e?.message || "Falha ao gerar PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!selectedTurma || !horariosDisponiveis || horariosDisponiveis.length === 0) {
      error("Selecione uma turma e configure os horários.");
      return;
    }

    const rows = buildGridRows();
    const tableRows = rows
      .map(
        (row) =>
          `<tr><td>${row.tempo}</td>${row.values
            .map((value) => `<td>${value || ""}</td>`)
            .join("")}</tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <title>Quadro de Horários</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: center; }
            th { background: #f8fafc; }
            td:first-child { text-align: left; min-width: 90px; }
          </style>
        </head>
        <body>
          <h1>Quadro de Horários</h1>
          <div class="meta">${escolaNome || "Escola"} • ${selectedTurma?.curso?.nome ?? "Curso"} • ${selectedTurma?.classe?.nome ?? "Classe"} • ${selectedTurma?.turma_codigo || selectedTurma?.turma_nome || selectedTurma?.nome || "Turma"} • Turno ${turnoLabel}${selectedTurma?.sala ? ` • Sala ${selectedTurma.sala}` : ""}</div>
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                ${DIAS_SEMANA.map((dia) => `<th>${dia}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      error("Não foi possível abrir a janela de impressão.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const submitQuadro = async (nextGrid: Record<string, string | null>, mode: "draft" | "publish") => {
    if (!escolaId || !turmaId || !versaoId) return;

    if (mode === "draft") {
      setSaving(true);
    } else {
      setPublishing(true);
    }
    setSaveError(null);

    const items = Object.entries(nextGrid)
      .map(([slotKey, disciplinaId]) => ({ slotKey, disciplinaId }))
      .filter(({ slotKey, disciplinaId }) => disciplinaId && slotLookup[slotKey])
      .map(({ slotKey, disciplinaId }) => {
        const aula = aulasWithAllocations.find((item) => item.id === disciplinaId);
        const salaId = selectedTurma?.sala
          ? salas.find((sala) => sala.nome === selectedTurma.sala)?.id ?? null
          : null;
        return {
          slot_id: slotLookup[slotKey],
          disciplina_id: disciplinaId as string,
          professor_id: aula?.professorId ?? null,
          sala_id: salaId,
        };
      });

    const payload = {
      versao_id: versaoId,
      turma_id: turmaId,
      items,
      mode,
    };

    setGrid(() => nextGrid);

    try {
      if (!online && mode === "draft") {
        await enqueueOfflineAction({
          url: `/api/escolas/${escolaId}/horarios/quadro`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          type: "horarios_quadro",
        });
        rawToast({
          variant: "info",
          title: "Quadro salvo no dispositivo.",
          message: "Sincronizaremos quando a conexão voltar.",
        });
        return;
      }
      if (!online && mode === "publish") {
        error("Modo offline: conecte-se para publicar o quadro.");
        return;
      }

      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setSaveError(json?.error || "Falha ao salvar quadro");
        if (json?.conflicts && Array.isArray(json.conflicts)) {
          const nextConflicts: Record<string, boolean> = {};
          for (const conflict of json.conflicts) {
            const slotKey = Object.entries(slotLookup).find(([, id]) => id === conflict.slot_id)?.[0];
            if (slotKey) nextConflicts[slotKey] = true;
          }
          setConflictSlots(nextConflicts);
        }
        if (json?.details?.missing?.length) {
          const nomes = json.details.missing
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          error("Cargas horárias pendentes", nomes.length ? nomes.join(", ") : json?.error);
        }
        if (json?.details?.mismatch?.length) {
          const nomes = json.details.mismatch
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          error("Distribuição incompleta", nomes.length ? nomes.join(", ") : json?.error);
        }
        return;
      }

      setConflictSlots({});
      success(
        mode === "publish" ? "Quadro publicado." : "Quadro salvo.",
        mode === "publish"
          ? "Publicação concluída sem pendências."
          : "Você pode ajustar a distribuição a qualquer momento."
      );
    } finally {
      if (mode === "draft") {
        setSaving(false);
      } else {
        setPublishing(false);
      }
    }
  };

  const handleSalvar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "draft");
  const handlePublicar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "publish");

  const handleAutoConfigurar = async () => {
    if (!escolaId || !turmaId) return;
    setAutoConfiguring(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/cargas/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId, strategy: "preset_then_default", overwrite: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        success("Cargas preenchidas", `${json?.data?.updated ?? 0} disciplina(s) atualizadas.`);
        setRefreshToken((prev) => prev + 1);
      } else {
        error(json?.error || "Falha ao configurar cargas");
      }
    } finally {
      setAutoConfiguring(false);
    }
  };

  const handleAutoCompletar = async () => {
    if (!escolaId || !turmaId) return;
    setAutoScheduling(true);
    try {
      const turnoId = selectedTurma ? mapTurnoId(selectedTurma.turno ?? "M") : undefined;
      const res = await fetch(`/api/escolas/${escolaId}/horarios/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turmaId,
          turno: turnoId,
          strategy: "v1",
          overwrite_unlocked: true,
          dry_run: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao auto-completar o quadro");
        return;
      }

      const reverseLookup: Record<string, string> = {};
      for (const [key, id] of Object.entries(slotLookup)) {
        reverseLookup[id] = key;
      }

      const nextGrid: Record<string, string | null> = {};
      const countByDisc: Record<string, number> = {};
      for (const assignment of json.assignments || []) {
        const slotKey = reverseLookup[assignment.slot_id];
        if (!slotKey) continue;
        nextGrid[slotKey] = assignment.disciplina_id;
        countByDisc[assignment.disciplina_id] = (countByDisc[assignment.disciplina_id] || 0) + 1;
      }

      setGrid(() => nextGrid);
      setAulas((prev) =>
        prev.map((aula) => ({
          ...aula,
          temposAlocados: countByDisc[aula.id] ?? 0,
        }))
      );
      setConflictSlots({});
      success(
        "Quadro gerado",
        `Preenchidos ${json?.stats?.filled ?? 0} de ${json?.stats?.total_slots ?? 0} slots.`
      );
      if (Array.isArray(json?.unmet) && json.unmet.length > 0) {
        const reasonLabel = (reason: string) => {
          switch (reason) {
            case "PROF_TURNO":
              return "Sem professor disponível no turno"
            case "SEM_PROF":
              return "Sem professor"
            case "SEM_SLOTS":
              return "Sem slots livres"
            case "CONFLITO_PROF":
              return "Conflito de professor"
            case "CONFLITO_SALA":
              return "Conflito de sala"
            case "REGRAS":
              return "Regras de distribuição"
            default:
              return reason
          }
        }
        const unmetDetails = json.unmet
          .map((item: any) => `${item.disciplina_id}: ${reasonLabel(item.reason)}`)
          .slice(0, 6)
        error("Pendências no auto-completar", unmetDetails.join(" | "))
      }
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleAssignProfessor = async (aula: (typeof aulas)[number], professorUserId: string) => {
    if (!turmaId) return;
    if (!aula?.cursoMatrizId) {
      error("Disciplina sem vínculo de currículo.");
      return;
    }
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/atribuir-professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplina_id: aula.cursoMatrizId,
          professor_user_id: professorUserId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao atribuir professor.");
      }
      success("Professor atribuído.");
      setRefreshToken((prev) => prev + 1);
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atribuir professor.");
    }
  };

  const handleAssignTurmaSala = async (salaId: string) => {
    if (!escolaId || !turmaId) return;
    const sala = salas.find((item) => item.id === salaId);
    if (!sala) {
      error("Sala não encontrada.");
      return;
    }
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas/${turmaId}/sala`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sala: sala.nome }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao atribuir sala.");
      }
      success("Sala atribuída à turma.");
      setTurmas((prev) =>
        prev.map((turma) =>
          turma.id === turmaId ? { ...turma, sala: sala.nome } : turma
        )
      );
      setBaseRefreshToken((prev) => prev + 1);
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atribuir sala.");
    }
  };

  const handleSaveCurriculoDisciplina = async (payload: DisciplinaForm) => {
    if (!escolaId) return;
    const target = curriculoDisciplinas.find((disc) => disc.id === payload.id);
    if (!target) return;
    let matrixIds = target.matrix_ids ?? [];
    if (payload.apply_scope === "selected" && payload.class_ids?.length) {
      matrixIds = payload.class_ids.flatMap(
        (classId) => target.matrix_by_class?.[classId] ?? []
      );
    }
    if (matrixIds.length === 0) return;
    try {
      await Promise.all(
        matrixIds.map(async (matrixId) => {
          const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: payload.nome,
              sigla: payload.codigo,
              carga_horaria_semanal: payload.carga_horaria_semanal,
              carga_horaria: payload.carga_horaria_semanal,
              classificacao: payload.classificacao,
              is_avaliavel: true,
              area: payload.area ?? null,
              periodos_ativos: payload.periodos_ativos,
              entra_no_horario: payload.entra_no_horario,
              avaliacao_mode: payload.avaliacao.mode,
              avaliacao_modelo_id: null,
              avaliacao_disciplina_id:
                payload.avaliacao.mode === "inherit_disciplina"
                  ? payload.avaliacao.base_id ?? null
                  : null,
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao atualizar disciplina.");
          }
        })
      );

      success("Disciplina atualizada.");
      setCurriculoModalOpen(false);
      setRefreshToken((prev) => prev + 1);
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atualizar disciplina.");
    }
  };

  const handleAddSala = async (nome: string) => {
    if (!nome.trim() || !escolaId) return;
    const res = await fetch(`/api/escolas/${escolaId}/salas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.item) {
      setSalas((prev) => [...prev, json.item]);
      success("Sala adicionada.");
      return;
    }
    error(json?.error || "Falha ao adicionar sala.");
  };

  if (isLoading && !turmaId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <Spinner className="text-klasse-gold" size={24} />
        <span className="ml-3 text-sm">Carregando quadro...</span>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <Link
                href={`/escola/${escolaId}/horarios/slots`}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Slots
              </Link>
              <Link
                href={`/escola/${escolaId}/horarios/quadro`}
                className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Quadro
              </Link>
            </div>
            <Select
              value={turmaId ?? ""}
              options={turmaOptions}
              onChange={(event) => setTurmaId(event.target.value || null)}
              className="max-w-xs rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold text-slate-900"
            />
            {selectedTurma?.sala ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Sala {selectedTurma.sala}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              {downloadingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3 w-3" />
              Imprimir
            </button>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner size={14} className="text-klasse-gold" />
                Sincronizando dados...
              </div>
            ) : null}
            {showOfflineStatus ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <WifiOff className="h-3 w-3" />
                Modo offline
              </div>
            ) : null}
            {baseError ? <span className="text-xs text-rose-600">{baseError}</span> : null}
            {turmaError ? <span className="text-xs text-rose-600">{turmaError}</span> : null}
            {saveError ? <span className="text-xs text-rose-600">{saveError}</span> : null}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Save className={`h-4 w-4 ${saving ? "text-klasse-gold" : "text-slate-300"}`} />
              <span>{saving ? "Salvando..." : "Alterações prontas"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {turmaId && excessoCarga > 0 && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Carga acima da capacidade do turno</p>
            <p className="text-xs text-rose-700 mt-1">
              A carga semanal do curso é {totalCarga} e o turno da {turnoLabel} suporta {totalSlots}.
            </p>
            <p className="text-xs text-rose-700 mt-1">
              Opção 1 (mais provável): reduzir a gordura do currículo para o padrão real do MED.
            </p>
            <p className="text-[11px] text-rose-600 mt-2">
              Capacidade do turno = número de aulas úteis por semana. Carga vem do currículo publicado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTurma?.curso_id && (
                <button
                  type="button"
                  onClick={() => setCurriculoModalOpen(true)}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white"
                >
                  Corrigir carga no currículo
                </button>
              )}
              <button
                type="button"
                onClick={handleAutoAdjustSlots}
                disabled={adjustingSlots || targetSlotsPerDay <= temposAulaCount}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
              >
                {adjustingSlots
                  ? "Ajustando slots..."
                  : `Aumentar slots para ${targetSlotsPerDay} aulas/dia`}
              </button>
              <button
                type="button"
                onClick={handleAddContraturno}
                disabled={generatingContraturno}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
              >
                {generatingContraturno
                  ? "Gerando contraturno..."
                  : "Adicionar aulas no turno da tarde"}
              </button>
            </div>
          </div>
        )}
        {turmaId && (
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Slots preenchidos</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {filledSlots}/{totalSlots || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalDias} dia(s) • {temposAulaCount} tempos/dia
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Disciplinas completas</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {disciplinasCompletas}/{aulas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Meta semanal por disciplina</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pendências de carga</p>
              <p className="text-2xl font-bold text-amber-600 mt-2">{missingLoadCount}</p>
              <p className="text-xs text-slate-500 mt-1">Sem carga definida</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Conflitos detectados</p>
              <p className="text-2xl font-bold text-rose-600 mt-2">{conflitosCount}</p>
              <p className="text-xs text-slate-500 mt-1">Professor/Sala</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sobrecarga</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overloadProfessores.length + overloadSalas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Professores + salas</p>
            </div>
          </div>
        )}
        {turmaId && disciplinasPendentes.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Disciplinas pendentes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {disciplinasPendentes.slice(0, 6).map((disc) => (
                <span
                  key={disc.id}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {disc.disciplina} {disc.temposAlocados}/{disc.temposTotal || "?"}
                </span>
              ))}
              {disciplinasPendentes.length > 6 && (
                <span className="text-xs text-slate-500">+{disciplinasPendentes.length - 6} mais</span>
              )}
            </div>
          </div>
        )}
        {turmaId && (overloadProfessores.length > 0 || overloadSalas.length > 0) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Alertas de sobrecarga</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overloadProfessores.map((prof) => (
                <span
                  key={`prof-${prof.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {prof.nome}: {prof.count} tempos
                </span>
              ))}
              {overloadSalas.map((sala) => (
                <span
                  key={`sala-${sala.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {sala.nome}: {sala.count} tempos
                </span>
              ))}
            </div>
          </div>
        )}
        {missingLoadCount > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">{missingLoadCount} disciplina(s) sem carga horária.</div>
            <div className="mt-1">Defina as cargas para publicar o quadro.</div>
          </div>
        )}
        {!turmaId ? (
          <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Selecione uma turma para montar o quadro.</p>
          </div>
        ) : (
          <SchedulerBoard
            diasSemana={DIAS_SEMANA}
            tempos={horariosDisponiveis}
            aulas={aulasWithAllocations}
            onSalvar={handleSalvar}
            grid={grid}
            onGridChange={(next) => setGrid(() => next)}
            slotLookup={slotLookup}
            existingAssignments={existingAssignments}
            conflictSlots={conflictSlots}
            salas={salas}
            professores={professores}
            onAssignProfessor={handleAssignProfessor}
            turmaSala={selectedTurma?.sala ?? null}
            onAssignTurmaSala={handleAssignTurmaSala}
            onAutoCompletar={handleAutoCompletar}
            autoCompleting={autoScheduling}
            onAutoConfigurarCargas={missingLoadCount > 0 ? handleAutoConfigurar : undefined}
            autoConfiguring={autoConfiguring}
            onPublicar={handlePublicar}
            canPublicar={canPublicar}
            publishDisabledReason={
              canPublicar ? undefined : "Defina todas as cargas horárias antes de publicar."
            }
            publishing={publishing}
          />
        )}

        {turmaId ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Adicionar sala"
              value={novaSala}
              onChange={(event) => setNovaSala(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold"
            />
            <button
              type="button"
              onClick={() => {
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-slate-950 shadow-sm"
            >
              Adicionar sala
            </button>
            <button
              type="button"
              onClick={handleClearQuadro}
              disabled={clearingQuadro}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {clearingQuadro ? "Limpando..." : "Limpar quadro"}
            </button>
          </div>
        ) : null}
      </div>
      </div>
      {curriculoModalOpen && selectedTurma?.curso_id && (
        <DisciplinaModal
          open={curriculoModalOpen}
          mode="edit"
          initial={(() => {
            const disciplina = curriculoDisciplinas.find((d) => d.id === curriculoSelectedId);
            if (!disciplina) return null;
            return {
              id: disciplina.id,
              nome: disciplina.nome,
              codigo: disciplina.codigo,
              periodos_ativos: disciplina.periodos_ativos?.length
                ? disciplina.periodos_ativos
                : [1, 2, 3],
              periodo_mode: disciplina.periodos_ativos?.length ? "custom" : "ano",
              carga_horaria_semanal: disciplina.carga_horaria_semanal,
              classificacao: disciplina.classificacao ?? (disciplina.is_core ? "core" : "complementar"),
              entra_no_horario: disciplina.entra_no_horario ?? true,
              avaliacao: {
                mode: disciplina.avaliacao_mode_key ?? "inherit_school",
                base_id: disciplina.avaliacao_disciplina_id ?? null,
              },
              area: disciplina.area ?? null,
              programa_texto: null,
              class_ids: disciplina.class_ids ?? [],
            };
          })()}
          existingCodes={curriculoDisciplinas.map((d) => d.codigo)}
          existingNames={curriculoDisciplinas.map((d) => d.nome)}
          existingDisciplines={curriculoDisciplinas.map((d) => ({ id: d.id, nome: d.nome }))}
          classOptions={curriculoClasses}
          disciplineSelector={{
            label: "Disciplina do currículo",
            value: curriculoSelectedId ?? undefined,
            options: curriculoDisciplinas.map((d) => {
              const base = d.base_weekly_hours;
              const isOut = base && base !== d.carga_horaria_semanal;
              return {
                id: d.id,
                nome: d.nome,
                label: isOut ? `⚠ ${d.nome} (MED ${base})` : d.nome,
              };
            }),
            onChange: (id) => setCurriculoSelectedId(id),
          }}
          standardInfo={(() => {
            const disciplina = curriculoDisciplinas.find((d) => d.id === curriculoSelectedId);
            if (!disciplina) return undefined;
            const baseHours = disciplina.base_weekly_hours ?? null;
            const isOut = Boolean(baseHours && baseHours !== disciplina.carga_horaria_semanal);
            return { baseHours, isOutOfStandard: isOut };
          })()}
          onClose={() => setCurriculoModalOpen(false)}
          onSave={handleSaveCurriculoDisciplina}
        />
      )}
    </>
  );
}
