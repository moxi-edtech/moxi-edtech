import { renderToBuffer, renderToStream, type DocumentProps } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"
import { createElement, type ReactElement } from "react"
import { applyKf2ListInvariants } from "@/lib/kf2"
import { GradeEngine, type RawGradeRow } from "@/lib/pedagogico/grade-engine"
import { TransitionEngine } from "@/lib/pedagogico/transition-engine"
import type { PautaAnualPayload, PautaAnualDisciplinaNotas } from "@/lib/pedagogico/pauta-anual-types"
import { PautaAnualV1 } from "@/templates/pdf/ministerio/PautaAnualV1"

type Client = SupabaseClient<Database>

const normalizeTipo = (tipo?: string | null) => {
  const normalized = (tipo ?? "").trim().toUpperCase()
  if (normalized === "NPT") return "PT"
  return normalized
}

const averageOrNull = (values: number[]) => {
  if (!values.length) return null
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Number((sum / values.length).toFixed(2))
}

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

export async function buildPautaAnualPayload({
  supabase,
  escolaId,
  turmaId,
}: {
  supabase: Client
  escolaId: string
  turmaId: string
}): Promise<PautaAnualPayload> {
  const { metadata, disciplinas, turmaDisciplinaToDisciplina } = await buildPautaAnualBase({
    supabase,
    escolaId,
    turmaId,
  })
  const turmaDisciplinaIds = Array.from(turmaDisciplinaToDisciplina.keys())

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

  const gradesMap = new Map<
    string,
    { mac: number[]; npp: number[]; pt: number[] }
  >()

  if (matriculaIds.length > 0 && turmaDisciplinaIds.length > 0) {
    const { data: notasRows, error: notasError } = await supabase
      .from("notas")
      .select("valor, matricula_id, avaliacoes ( trimestre, tipo, turma_disciplina_id )")
      .eq("escola_id", escolaId)
      .in("matricula_id", matriculaIds)
      .in("avaliacoes.turma_disciplina_id", turmaDisciplinaIds)

    if (notasError) throw new Error(notasError.message)

    for (const row of (notasRows || []) as any[]) {
      const avaliacao = Array.isArray(row.avaliacoes) ? row.avaliacoes[0] : row.avaliacoes
      const trimestre = avaliacao?.trimestre as 1 | 2 | 3 | null
      if (!trimestre) continue
      const disciplina = turmaDisciplinaToDisciplina.get(avaliacao?.turma_disciplina_id)
      if (!disciplina) continue

      const tipo = normalizeTipo(avaliacao?.tipo)
      if (!tipo || !["MAC", "NPP", "PT"].includes(tipo)) continue

      const key = `${row.matricula_id}:${disciplina.id}:${trimestre}`
      const entry = gradesMap.get(key) ?? { mac: [], npp: [], pt: [] }
      if (typeof row.valor === "number") {
        if (tipo === "MAC") entry.mac.push(row.valor)
        if (tipo === "NPP") entry.npp.push(row.valor)
        if (tipo === "PT") entry.pt.push(row.valor)
      }
      gradesMap.set(key, entry)
    }
  }

  const rawGrades: RawGradeRow[] = []
  for (const [alunoId, info] of alunoInfo.entries()) {
    for (const disciplina of disciplinas) {
      for (const trimestre of [1, 2, 3] as const) {
        const key = `${alunoId}:${disciplina.id}:${trimestre}`
        const entry = gradesMap.get(key)
        rawGrades.push({
          aluno_id: alunoId,
          aluno_nome: info.nome,
          numero_turma: info.numero,
          disciplina_id: disciplina.id,
          disciplina_nome: disciplina.nome,
          trimestre,
          mac: entry ? averageOrNull(entry.mac) : null,
          npp: entry ? averageOrNull(entry.npp) : null,
          pt: entry ? averageOrNull(entry.pt) : null,
        })
      }
    }
  }

  const pautaMatrix = GradeEngine.generatePautaMatrix(rawGrades)
  const pautaFinal = TransitionEngine.processTurma(pautaMatrix)

  const alunos = pautaFinal.map((student) => {
    const info = alunoInfo.get(student.aluno_id)
    const disciplinasNotas: Record<string, PautaAnualDisciplinaNotas> = {}
    disciplinas.forEach((disciplina) => {
      const subject = student.disciplinas[disciplina.id]
      disciplinasNotas[disciplina.id] = {
        mt1: subject?.t1?.mt ?? "-",
        mt2: subject?.t2?.mt ?? "-",
        mt3: subject?.t3?.mt ?? "-",
        mfd: subject?.mfd ?? "-",
      }
    })

    return {
      aluno_id: student.aluno_id,
      numero: info?.numero ?? student.numero_turma,
      nome: info?.nome ?? student.aluno_nome,
      idade: info?.idade ?? "-",
      sexo: info?.sexo ?? "M",
      disciplinas: disciplinasNotas,
      resultado_final: student.resultado_final,
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

  const alunos = Array.from({ length: linhas }).map((_, index) => {
    const disciplinasNotas: Record<string, PautaAnualDisciplinaNotas> = {}
    disciplinas.forEach((disciplina) => {
      disciplinasNotas[disciplina.id] = { ...emptyNotas }
    })
    return {
      aluno_id: `modelo-${index + 1}`,
      numero: index + 1,
      nome: "____________________________",
      idade: "-",
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
    .select("nome, responsavel, diretor_nome")
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
      subDirector: escola?.responsavel ?? "—",
      diretorGeral: escola?.diretor_nome ?? escola?.responsavel ?? "—",
      local: "—",
    },
    disciplinas,
    turmaDisciplinaToDisciplina,
  }
}
