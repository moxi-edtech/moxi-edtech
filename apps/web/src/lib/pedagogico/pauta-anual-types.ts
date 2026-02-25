export type PautaAnualDisciplina = {
  id: string
  nome: string
  conta_para_media_med?: boolean
}

export type PautaAnualDisciplinaNotas = {
  mt1: number | "-"
  mt2: number | "-"
  mt3: number | "-"
  mfd: number | "-"
}

export type PautaAnualAlunoRow = {
  aluno_id: string
  numero: number
  nome: string
  idade: number | "-"
  sexo: string
  disciplinas: Record<string, PautaAnualDisciplinaNotas>
  resultado_final: string
}

export type PautaAnualMetadata = {
  provincia: string
  escola: string
  anoLectivo: string
  turma: string
  curso: string
  classe: string
  turno: string
  emissao: string
  diretorTurma: string
  subDirector: string
  diretorGeral: string
  local: string
}

export type PautaAnualPayload = {
  metadata: PautaAnualMetadata
  disciplinas: PautaAnualDisciplina[]
  alunos: PautaAnualAlunoRow[]
}
