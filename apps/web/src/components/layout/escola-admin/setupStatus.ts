export type SetupStatus = {
  anoLetivoOk: boolean;
  periodosOk: boolean;
  avaliacaoOk: boolean;
  frequenciaOk: boolean;
  avaliacaoFrequenciaOk: boolean;
  curriculoOk: boolean;
  turmasOk: boolean;
  setupComplete: boolean;
  /** Falha de leitura: nunca tratar como pendência da escola. */
  validationUnavailable?: boolean;
};
