// /lib/turmaNaming.ts
export function gerarNomeTurma(
  cursoNome: string,
  turma_codigo: string,
  ano_letivo: number,
  turno: string,
  padrao: 'descritivo_completo' | 'descritivo_simples' | 'abreviado'
): string {
  const turnoFormatado = formatarTurno(turno);
  const siglaCurso = gerarSiglaCurso(cursoNome);

  switch(padrao) {
    case 'descritivo_completo':
      return `${cursoNome} - ${turma_codigo} - ${ano_letivo} - ${turnoFormatado}`;
    case 'descritivo_simples':
      return `${cursoNome} ${turma_codigo} (${ano_letivo})`;
    case 'abreviado':
      return `${siglaCurso} ${turma_codigo}${turno[0].toUpperCase()}`;
    default:
      return `${cursoNome} - ${turma_codigo} - ${ano_letivo}`;
  }
}

function formatarTurno(turno: string): string {
  const map: { [key: string]: string } = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
  return map[turno] || turno;
}

function gerarSiglaCurso(cursoNome: string): string {
  // Lógica simples: pega as primeiras letras das palavras
  return cursoNome
    .split(' ')
    .map(palavra => palavra[0])
    .join('')
    .toUpperCase();
}
