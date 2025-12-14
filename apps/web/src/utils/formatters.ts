export const formatTurmaName = (turma: any, includeCourse = false) => {
  const shortClasse = turma?.classes?.nome
    ? String(turma.classes.nome).replace(' Classe', '')
    : '';

  const nome = turma?.nome ?? '';
  const turno = turma?.turno ?? '';

  let base = `${shortClasse ? `${shortClasse} ` : ''}${nome}${turno ? ` (${turno})` : ''}`.trim();

  if (includeCourse && turma?.cursos?.nome && turma?.cursos?.tipo === 'tecnico') {
    const cursoLabel = turma.cursos.codigo?.toUpperCase() || turma.cursos.nome;
    base = `${shortClasse ? `${shortClasse} ` : ''}${nome} (${cursoLabel})${turno ? ` - ${turno}` : ''}`.trim();
  }

  return base;
};
