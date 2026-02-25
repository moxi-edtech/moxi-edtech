import { renderToBuffer, renderToStream, type DocumentProps } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"
import { createElement, type ReactElement } from "react"
import { applyKf2ListInvariants } from "@/lib/kf2"
import type {
  PautaAnualPayload,
  PautaAnualDisciplinaNotas,
  PautaAnualAlunoRow,
} from "@/lib/pedagogico/pauta-anual-types"
import { PautaAnualV1 } from "@/templates/pdf/ministerio/PautaAnualV1"

type Client = SupabaseClient<Database>

const calculateAge = (dateValue: string | null | undefined) => {
  if (!dateValue) return "-"
  const birth = new Date(dateValue)
  if (Number.isNaN(birth.getTime())) return "-"
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : "-"
}


const NOTA_MINIMA_APROVACAO = 10
const MAX_NEGATIVAS_RECURSO = 2

type BoletimNotaRow = {
  matricula_id: string | null
  disciplina_id: string | null
  trimestre: number | null
  nota_final: number | null
}

function avaliarResultadoFinal(mfds: Array<number | "-">): "APROVADO" | "REPROVADO" | "RECURSO" | "PENDENTE" {
  if (mfds.length === 0) return "PENDENTE"
  if (mfds.some((mfd) => mfd === "-")) return "PENDENTE"

  let negativas = 0
  for (const mfd of mfds) {
    if (typeof mfd === 'number' && mfd < NOTA_MINIMA_APROVACAO) negativas += 1
  }

  if (negativas === 0) return "APROVADO"
  if (negativas <= MAX_NEGATIVAS_RECURSO) return "RECURSO"
  return "REPROVADO"
}

export async function buildPautaAnualPayload({
  supabase,
  escolaId,
  turmaId,
}: {
  supabase: Client
  escolaId: string
  turmaId: string
}): Promise<PautaAnualPayload> {
  const { metadata, disciplinas } = await buildPautaAnualBase({
    supabase,
    escolaId,
    turmaId,
  })
  let matriculasQuery = supabase
    .from("matriculas")
    .select(
      `
      id,
      numero_chamada,
      alunos!inner (
        id,
        nome,
        data_nascimento,
        sexo
      )
    `
    )
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .in("status", ["ativo", "ativa", "active"])
    .order("numero_chamada", { ascending: true, nullsFirst: false })

  matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 1000 })

  const { data: matriculas, error: matriculasError } = await matriculasQuery
  if (matriculasError) throw new Error(matriculasError.message)

  const matriculaRows = (matriculas || []).filter((row: any) => row?.alunos)
  const matriculaIds = matriculaRows.map((row: any) => row.id)

  const alunoInfo = new Map<
    string,
    { numero: number; nome: string; idade: number | "-"; sexo: string }
  >()
  matriculaRows.forEach((row: any, index: number) => {
    const aluno = row.alunos
    const numero = row.numero_chamada ?? index + 1
    const sexoRaw = (aluno?.sexo ?? "").toString().toUpperCase()
    alunoInfo.set(aluno.id, {
      numero,
      nome: aluno?.nome ?? "Sem nome",
      idade: calculateAge(aluno?.data_nascimento ?? null),
      sexo: sexoRaw === "F" ? "F" : "M",
    })
  })

  const disciplinaIds = disciplinas.map((d) => d.id)
  const boletimByAlunoDisc = new Map<string, { t1: number | null; t2: number | null; t3: number | null }>()

  if (matriculaIds.length > 0 && disciplinaIds.length > 0) {
    const { data: boletimRows, error: boletimError } = await supabase
      .from("vw_boletim_por_matricula")
      .select("matricula_id, disciplina_id, trimestre, nota_final")
      .eq("turma_id", turmaId)
      .in("matricula_id", matriculaIds)
      .in("disciplina_id", disciplinaIds)

    if (boletimError) throw new Error(boletimError.message)

    for (const row of (boletimRows || []) as BoletimNotaRow[]) {
      if (!row?.matricula_id || !row?.disciplina_id) continue
      const key = `${row.matricula_id}:${row.disciplina_id}`
      const current = boletimByAlunoDisc.get(key) ?? { t1: null, t2: null, t3: null }
      if (row.trimestre === 1) current.t1 = row.nota_final
      if (row.trimestre === 2) current.t2 = row.nota_final
      if (row.trimestre === 3) current.t3 = row.nota_final
      boletimByAlunoDisc.set(key, current)
    }
  }

  const alunos = matriculaRows.map((row: any, index: number) => {
    const alunoId = row?.alunos?.id as string
    const info = alunoInfo.get(alunoId)
    const disciplinasNotas: Record<string, PautaAnualDisciplinaNotas> = {}
    const mfds: Array<number | "-"> = []

    disciplinas.forEach((disciplina) => {
      const key = `${row.id}:${disciplina.id}`
      const notas = boletimByAlunoDisc.get(key) ?? { t1: null, t2: null, t3: null }
      const mt1 = typeof notas.t1 === "number" ? Number(notas.t1.toFixed(2)) : "-"
      const mt2 = typeof notas.t2 === "number" ? Number(notas.t2.toFixed(2)) : "-"
      const mt3 = typeof notas.t3 === "number" ? Number(notas.t3.toFixed(2)) : "-"

      let mfd: number | "-" = "-"
      if (typeof mt1 === "number" && typeof mt2 === "number" && typeof mt3 === "number") {
        mfd = Math.round((mt1 + mt2 + mt3) / 3)
      }

      mfds.push(mfd)
      disciplinasNotas[disciplina.id] = { mt1, mt2, mt3, mfd }
    })

    return {
      aluno_id: alunoId,
      numero: info?.numero ?? row.numero_chamada ?? index + 1,
      nome: info?.nome ?? row?.alunos?.nome ?? "Sem nome",
      idade: info?.idade ?? "-",
      sexo: info?.sexo ?? "M",
      disciplinas: disciplinasNotas,
      resultado_final: avaliarResultadoFinal(mfds),
    }
  })

  return {
    metadata,
    disciplinas,
    alunos,
  }
}

export async function renderPautaAnualStream(payload: PautaAnualPayload) {
  const element = createElement(PautaAnualV1, payload) as unknown as ReactElement<DocumentProps>
  return renderToStream(element)
}

export async function renderPautaAnualBuffer(payload: PautaAnualPayload) {
  const element = createElement(PautaAnualV1, payload) as unknown as ReactElement<DocumentProps>
  return renderToBuffer(element)
}

export async function buildPautaAnualModeloPayload({
  supabase,
  escolaId,
  turmaId,
  linhas = 20,
}: {
  supabase: Client
  escolaId: string
  turmaId: string
  linhas?: number
}): Promise<PautaAnualPayload> {
  const { metadata, disciplinas } = await buildPautaAnualBase({ supabase, escolaId, turmaId })
  const emptyNotas: PautaAnualDisciplinaNotas = { mt1: "-", mt2: "-", mt3: "-", mfd: "-" }

  const alunos: PautaAnualAlunoRow[] = Array.from({ length: linhas }).map((_, index) => {
    const disciplinasNotas: Record<string, PautaAnualDisciplinaNotas> = {}
    disciplinas.forEach((disciplina) => {
      disciplinasNotas[disciplina.id] = { ...emptyNotas }
    })
    return {
      aluno_id: `modelo-${index + 1}`,
      numero: index + 1,
      nome: "____________________________",
      idade: "-" as const,
      sexo: "-",
      disciplinas: disciplinasNotas,
      resultado_final: "—",
    }
  })

  return { metadata, disciplinas, alunos }
}

async function buildPautaAnualBase({
  supabase,
  escolaId,
  turmaId,
}: {
  supabase: Client
  escolaId: string
  turmaId: string
}) {
  const { data: turma } = await supabase
    .from("turmas")
    .select("id, nome, curso_id, classe_id, ano_letivo, turno, diretor_turma_id, cursos(nome), classes(nome)")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .maybeSingle()

  if (!turma) {
    throw new Error("Turma não encontrada")
  }

  const cursoNome = (turma as any)?.cursos?.nome ?? "—"
  const classeNome = (turma as any)?.classes?.nome ?? "—"

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle()

  let diretorNome: string | null = null
  if (turma.diretor_turma_id) {
    const { data: diretor } = await supabase
      .from("escola_users")
      .select("user_id")
      .eq("id", turma.diretor_turma_id)
      .maybeSingle()
    if (diretor?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", diretor.user_id)
        .maybeSingle()
      diretorNome = (profile as any)?.nome ?? null
    }
  }

  const { data: turmaDisciplinas } = await supabase
    .from("turma_disciplinas")
    .select(
      "id, curso_matriz_id, curso_matriz(disciplina_id, disciplinas_catalogo(id, nome))"
    )
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)

  const disciplinaMap = new Map<string, { id: string; nome: string }>()
  const turmaDisciplinaToDisciplina = new Map<string, { id: string; nome: string }>()

  for (const row of (turmaDisciplinas || []) as any[]) {
    const disciplinaId = row?.curso_matriz?.disciplina_id ?? row?.curso_matriz?.disciplinas_catalogo?.id
    const disciplinaNome =
      row?.curso_matriz?.disciplinas_catalogo?.nome ?? "Disciplina"
    if (!disciplinaId) continue
    if (!disciplinaMap.has(disciplinaId)) {
      disciplinaMap.set(disciplinaId, { id: disciplinaId, nome: disciplinaNome })
    }
    if (row?.id) {
      turmaDisciplinaToDisciplina.set(row.id, { id: disciplinaId, nome: disciplinaNome })
    }
  }

  const disciplinas = Array.from(disciplinaMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))

  return {
    metadata: {
      provincia: "—",
      escola: escola?.nome ?? "Escola",
      anoLectivo: turma.ano_letivo ? String(turma.ano_letivo) : "—",
      turma: turma.nome ?? "Turma",
      curso: cursoNome,
      classe: classeNome,
      turno: turma.turno ?? "—",
      emissao: new Date().toLocaleString("pt-PT"),
      diretorTurma: diretorNome ?? "—",
      subDirector: "—",
      diretorGeral: "—",
      local: "—",
    },
    disciplinas,
    turmaDisciplinaToDisciplina,
  }
}
