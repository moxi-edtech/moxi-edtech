import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { QuadroHorarioPdf } from "@/templates/pdf/horarios/QuadroHorario";

type SupabaseLike = any;

type TurmaRow = {
  id: string;
  escola_id: string;
  nome: string | null;
  turma_codigo?: string | null;
  sala: string | null;
  turno: string | null;
  ano_letivo: number | null;
  curso_id: string | null;
  classe_id: string | null;
};

type SlotRow = {
  id: string;
  dia_semana: number | null;
  ordem: number | null;
  inicio: string | null;
  fim: string | null;
};

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

function formatSlotTime(value?: string | null) {
  return String(value ?? "").slice(0, 5);
}

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "horario";
}

async function resolvePublishedVersionId(
  supabase: SupabaseLike,
  escolaId: string,
  turmaId: string,
  requestedVersionId?: string | null
) {
  if (requestedVersionId) return requestedVersionId;

  const { data } = await supabase
    .from("horario_versoes")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("status", "publicada")
    .order("publicado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

function buildSlotMaps(slots: SlotRow[]) {
  const byOrder = new Map<number, SlotRow[]>();
  const slotKeyById = new Map<string, string>();

  for (const slot of slots) {
    if (!slot.id || !slot.ordem || !slot.dia_semana || slot.dia_semana < 1 || slot.dia_semana > 5) continue;
    const list = byOrder.get(slot.ordem) ?? [];
    list.push(slot);
    byOrder.set(slot.ordem, list);
    slotKeyById.set(slot.id, `${DIAS_SEMANA[slot.dia_semana - 1]}-${slot.ordem}`);
  }

  const rows = Array.from(byOrder.entries())
    .sort(([a], [b]) => a - b)
    .map(([ordem, items]) => {
      const first = [...items].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))[0];
      const inicio = formatSlotTime(first?.inicio);
      const fim = formatSlotTime(first?.fim);
      return {
        key: String(ordem),
        tempo: inicio && fim ? `${inicio} - ${fim}` : String(ordem),
      };
    });

  return { rows, slotKeyById };
}

function disciplinaLabel(nome?: string | null) {
  const value = String(nome ?? "").trim();
  return value.slice(0, 3).toUpperCase() || "DISC";
}

export async function renderHorarioTurmaPdfBuffer({
  supabase,
  escolaId,
  turmaId,
  versaoId,
}: {
  supabase: SupabaseLike;
  escolaId: string;
  turmaId: string;
  versaoId?: string | null;
}) {
  const { data: turma, error: turmaError } = await supabase
    .from("turmas")
    .select("id, escola_id, nome, turma_codigo, sala, turno, ano_letivo, curso_id, classe_id")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (turmaError) throw new Error(turmaError.message);
  if (!turma) throw new Error("Turma não encontrada");

  const effectiveVersionId = await resolvePublishedVersionId(supabase, escolaId, turmaId, versaoId);
  if (!effectiveVersionId) throw new Error("Esta turma ainda não tem horário publicado.");

  const [escolaRes, cursoRes, classeRes, slotsRes, quadroRes] = await Promise.all([
    supabase.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
    (turma as TurmaRow).curso_id
      ? supabase.from("cursos").select("nome").eq("id", (turma as TurmaRow).curso_id).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    (turma as TurmaRow).classe_id
      ? supabase.from("classes").select("nome").eq("id", (turma as TurmaRow).classe_id).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("horario_slots")
      .select("id, dia_semana, ordem, inicio, fim")
      .eq("escola_id", escolaId)
      .order("ordem", { ascending: true })
      .order("dia_semana", { ascending: true }),
    supabase
      .from("quadro_horarios")
      .select("slot_id, disciplina_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("versao_id", effectiveVersionId),
  ]);

  if (escolaRes.error) throw new Error(escolaRes.error.message);
  if (cursoRes.error) throw new Error(cursoRes.error.message);
  if (classeRes.error) throw new Error(classeRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (quadroRes.error) throw new Error(quadroRes.error.message);

  const slots = (slotsRes.data ?? []) as SlotRow[];
  const quadroItems = quadroRes.data ?? [];
  if (slots.length === 0) throw new Error("Configure os tempos da escola antes de baixar o horário.");
  if (quadroItems.length === 0) throw new Error("Esta turma ainda não tem horário publicado.");

  const disciplinaIds = Array.from(new Set(quadroItems.map((item: any) => item.disciplina_id).filter(Boolean))) as string[];
  const { data: disciplinas, error: disciplinasError } = disciplinaIds.length
    ? await supabase
        .from("disciplinas_catalogo")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .in("id", disciplinaIds)
    : { data: [] as any[], error: null };

  if (disciplinasError) throw new Error(disciplinasError.message);

  const disciplinaById = new Map<string, string>();
  for (const disciplina of disciplinas ?? []) {
    disciplinaById.set(String(disciplina.id), disciplinaLabel(disciplina.nome));
  }

  const { rows, slotKeyById } = buildSlotMaps(slots);
  const gridByKey = new Map<string, string>();
  for (const item of quadroItems) {
    const key = slotKeyById.get(String(item.slot_id));
    if (!key) continue;
    gridByKey.set(key, disciplinaById.get(String(item.disciplina_id)) ?? "");
  }

  const turmaRow = turma as TurmaRow;
  const turmaNome = turmaRow.turma_codigo || turmaRow.nome || "Turma";
  const element = (
    <QuadroHorarioPdf
      escola={escolaRes.data?.nome ?? "Escola"}
      curso={cursoRes.data?.nome ?? "Curso"}
      classe={classeRes.data?.nome ?? "Classe"}
      turma={turmaNome}
      turno={turmaRow.turno ?? "Turno"}
      sala={turmaRow.sala ?? null}
      anoLetivo={turmaRow.ano_letivo ?? null}
      dias={DIAS_SEMANA}
      tempos={rows.map((row) => row.tempo)}
      grid={rows.map((row) => DIAS_SEMANA.map((dia) => gridByKey.get(`${dia}-${row.key}`) ?? ""))}
      generatedAt={new Date().toLocaleString("pt-PT")}
    />
  ) as React.ReactElement<DocumentProps>;

  return {
    buffer: await renderToBuffer(element),
    filename: `Horario_${sanitizeFilename(turmaNome)}${turmaRow.sala ? `_Sala-${sanitizeFilename(turmaRow.sala)}` : ""}.pdf`,
  };
}
