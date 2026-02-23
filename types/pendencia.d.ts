// types/pendencia.d.ts

export type PendenciaTipo = {
  tipo:           string
  avaliacao_id:   string | null
  notas_lancadas: number
  pendentes:      number
  status:         "ok" | "pendente" | "sem_avaliacao" | "sem_alunos" | "SEM_AVALIACAO" | "NOTAS_PENDENTES" | "OK"
}

export type PendenciaItem = {
  turma_disciplina_id: string
  turma_id:            string
  turma_nome:          string | null
  disciplina_id:       string | null
  disciplina_nome:     string | null
  trimestre:           number | null
  total_alunos:        number
  tipos:               PendenciaTipo[]
}

// Additional type for the API response, if needed
export type PendenciasResponse = {
  items:  PendenciaItem[]
  resumo: { total_pendencias: number; turmas_afetadas: number }
}
