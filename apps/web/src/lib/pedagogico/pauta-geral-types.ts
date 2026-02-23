export type PautaGeralDisciplina = {
  id: string
  nome: string
}

export type PautaGeralDisciplinaNotas = {
  mac: number | "-"
  npp: number | "-"
  pt: number | "-"
  mt: number | "-"
}

export type PautaGeralAlunoRow = {
  aluno_id: string
  numero: number
  nome: string
  idade: number | "-"
  sexo: string
  disciplinas: Record<string, PautaGeralDisciplinaNotas>
  obs: string
}

export type PautaGeralMetadata = {
  provincia: string
  escola: string
  anoLectivo: string
  turma: string
  curso: string
  classe: string
  turno: string
  trimestre: string
  emissao: string
  diretorTurma: string
  subDirector: string
  diretorGeral: string
  local: string
}

export type PautaGeralPayload = {
  metadata: PautaGeralMetadata
  disciplinas: PautaGeralDisciplina[]
  alunos: PautaGeralAlunoRow[]
}
