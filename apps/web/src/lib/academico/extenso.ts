export function notaParaExtensoPTAO(nota: number): string {
  const notaArredondada = Math.round(nota)
  const mapa = [
    'Zero',
    'Um',
    'Dois',
    'Três',
    'Quatro',
    'Cinco',
    'Seis',
    'Sete',
    'Oito',
    'Nove',
    'Dez',
    'Onze',
    'Doze',
    'Treze',
    'Catorze',
    'Quinze',
    'Dezasseis',
    'Dezassete',
    'Dezoito',
    'Dezanove',
    'Vinte',
  ]

  if (notaArredondada < 0 || notaArredondada > 20) return 'Nota inválida'
  return `${mapa[notaArredondada]} valores`
}
