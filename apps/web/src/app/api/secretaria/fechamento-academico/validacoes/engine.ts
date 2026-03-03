import { randomUUID } from "crypto";
import type { RelatorioSanidadeFechamento, PendenciaFechamento } from "./types";

type SnapshotStatus = "aberto" | "fechado" | "reaberto";

export async function executarValidacoesFechamento(params: {
  supabase: any;
  escolaId: string;
  acao: "fechar_trimestre" | "fechar_ano";
  anoLetivoId: string;
  periodoLetivoId?: string;
  turmaIds?: string[];
  runId?: string;
  allowReabertoOverride?: boolean;
}): Promise<RelatorioSanidadeFechamento> {
  const { supabase, escolaId, acao, anoLetivoId, periodoLetivoId } = params;

  const { data: anoRow } = await supabase
    .from("anos_letivos")
    .select("ano")
    .eq("escola_id", escolaId)
    .eq("id", anoLetivoId)
    .single();

  const anoNumero = Number(anoRow?.ano ?? -1);
  let turmaIds = params.turmaIds ?? [];

  if (turmaIds.length === 0) {
    const { data: turmas } = await supabase.from("turmas").select("id").eq("escola_id", escolaId).eq("ano_letivo", anoNumero);
    turmaIds = (turmas ?? []).map((t: any) => String(t.id));
  }

  const pendencias: PendenciaFechamento[] = [];

  const { data: snapshots } = await supabase
    .from("historico_snapshot_locks")
    .select("id,matricula_id,status,allow_reopen")
    .eq("escola_id", escolaId)
    .eq("ano_letivo_id", anoLetivoId)
    .in("status", ["fechado", "reaberto"]);

  const snapshotByMatricula = new Map<string, { id: string; status: SnapshotStatus; allow_reopen: boolean | null }>();
  (snapshots ?? []).forEach((row: any) => {
    snapshotByMatricula.set(String(row.matricula_id), {
      id: String(row.id),
      status: String(row.status) as SnapshotStatus,
      allow_reopen: row.allow_reopen ?? null,
    });
  });

  let periodoNumero: number | null = null;
  if (acao === "fechar_trimestre" && periodoLetivoId) {
    const { data: periodo } = await supabase
      .from("periodos_letivos")
      .select("numero")
      .eq("escola_id", escolaId)
      .eq("id", periodoLetivoId)
      .single();
    periodoNumero = Number(periodo?.numero ?? 0) || null;
  }

  for (const turmaId of turmaIds) {
    const { data: matriculas } = await supabase
      .from("matriculas")
      .select("id,aluno_id,status,turma_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("ano_letivo", anoNumero);

    const turmaMatriculas = matriculas ?? [];
    const ativos = turmaMatriculas.filter((m: any) => ["ativo", "ativa", "active"].includes(String(m.status || "").toLowerCase()));

    for (const m of turmaMatriculas) {
      const st = String(m.status ?? "").toLowerCase();
      if ((st === "ativo" || st === "ativa" || st === "active") && !m.turma_id) {
        pendencias.push({
          id: randomUUID(),
          regra: "MATRICULA_INCONSISTENTE",
          severidade: "CRITICAL",
          turma_id: turmaId,
          matricula_id: String(m.id),
          aluno_id: String(m.aluno_id),
          mensagem: "Matrícula ativa sem turma vinculada.",
          detalhe: { status: m.status },
          pode_excecao: true,
        });
      }

      const snapshot = snapshotByMatricula.get(String(m.id));
      if (snapshot?.status === "fechado") {
        pendencias.push({
          id: randomUUID(),
          regra: "SNAPSHOT_LEGAL_CONFLITO",
          severidade: "CRITICAL",
          turma_id: turmaId,
          matricula_id: String(m.id),
          aluno_id: String(m.aluno_id),
          mensagem: "Histórico legal já congelado (status fechado). Reabertura auditada é obrigatória.",
          detalhe: { snapshot_lock_id: snapshot.id, snapshot_status: snapshot.status },
          pode_excecao: false,
        });
      }

      if (snapshot?.status === "reaberto" && !params.allowReabertoOverride) {
        pendencias.push({
          id: randomUUID(),
          regra: "SNAPSHOT_LEGAL_CONFLITO",
          severidade: "CRITICAL",
          turma_id: turmaId,
          matricula_id: String(m.id),
          aluno_id: String(m.aluno_id),
          mensagem: "Histórico em estado reaberto exige override explícito para nova consolidação.",
          detalhe: { snapshot_lock_id: snapshot.id, snapshot_status: snapshot.status, allow_reopen: snapshot.allow_reopen ?? false },
          pode_excecao: false,
        });
      }
    }

    if (acao === "fechar_trimestre" && periodoNumero) {
      const { data: pauta } = await supabase
        .from("pautas_oficiais")
        .select("id,status")
        .eq("escola_id", escolaId)
        .eq("turma_id", turmaId)
        .eq("periodo_letivo_id", periodoLetivoId)
        .eq("tipo", "trimestral")
        .maybeSingle();

      if (!pauta || pauta.status !== "SUCCESS") {
        pendencias.push({
          id: randomUUID(),
          regra: "PAUTA_NAO_EMITIDA",
          severidade: "CRITICAL",
          turma_id: turmaId,
          mensagem: "Pauta oficial trimestral ainda não emitida com sucesso.",
          detalhe: { periodo_letivo_id: periodoLetivoId, pauta_status: pauta?.status ?? null },
          pode_excecao: true,
        });
      }

      if (ativos.length > 0) {
        const ids = ativos.map((m: any) => String(m.id));

        const { data: notasRows } = await supabase
          .from("vw_boletim_por_matricula")
          .select("matricula_id")
          .eq("escola_id", escolaId)
          .eq("turma_id", turmaId)
          .eq("trimestre", periodoNumero)
          .in("matricula_id", ids);

        const notasSet = new Set((notasRows ?? []).map((r: any) => String(r.matricula_id)));
        for (const m of ativos) {
          if (!notasSet.has(String(m.id))) {
            pendencias.push({
              id: randomUUID(),
              regra: "NOTAS_PENDENTES",
              severidade: "CRITICAL",
              turma_id: turmaId,
              matricula_id: String(m.id),
              aluno_id: String(m.aluno_id),
              mensagem: "Sem notas consolidadas no trimestre para matrícula ativa.",
              detalhe: { trimestre: periodoNumero },
              pode_excecao: true,
            });
          }
        }

        const { data: freqRows } = await supabase
          .from("frequencia_status_periodo")
          .select("matricula_id")
          .eq("escola_id", escolaId)
          .eq("turma_id", turmaId)
          .eq("periodo_letivo_id", periodoLetivoId)
          .in("matricula_id", ids);

        const freqSet = new Set((freqRows ?? []).map((r: any) => String(r.matricula_id)));
        for (const m of ativos) {
          if (!freqSet.has(String(m.id))) {
            pendencias.push({
              id: randomUUID(),
              regra: "FREQUENCIAS_PENDENTES",
              severidade: "CRITICAL",
              turma_id: turmaId,
              matricula_id: String(m.id),
              aluno_id: String(m.aluno_id),
              mensagem: "Sem frequência consolidada no período para matrícula ativa.",
              detalhe: { periodo_letivo_id: periodoLetivoId },
              pode_excecao: true,
            });
          }
        }
      }
    }
  }

  const critical = pendencias.filter((p) => p.severidade === "CRITICAL").length;
  const warn = pendencias.length - critical;

  return {
    ok: critical === 0,
    acao,
    escola_id: escolaId,
    ano_letivo_id: anoLetivoId,
    periodo_letivo_id: periodoLetivoId,
    pendencias,
    summary: {
      total: pendencias.length,
      critical,
      warn,
      turmas_afetadas: new Set(pendencias.map((p) => p.turma_id).filter(Boolean)).size,
      matriculas_afetadas: new Set(pendencias.map((p) => p.matricula_id).filter(Boolean)).size,
    },
  };
}
