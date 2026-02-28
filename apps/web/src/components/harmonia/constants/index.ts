// apps/web/src/components/harmonia/constants/index.ts
import { ProximoPassoConfig, EstadoVazioConfig } from "../types";

export const PROXIMOS_PASSOS: Record<string, ProximoPassoConfig> = {
  "matricula.confirmada": {
    titulo: "Matrícula confirmada",
    subtitulo: (ctx) => `${ctx.nome} · ${ctx.turma} · ${ctx.anoLetivo}`,
    passos: [
      { id: "emitir_boletim",   label: "Emitir Boletim de Matrícula", desc: "Documento oficial com QR code",     icone: "◉", destaque: true  },
      { id: "registar_propina", label: "Registar Propina",            desc: "Primeiro pagamento do ano lectivo", icone: "◈", destaque: false },
      { id: "nova_matricula",   label: "Matricular outro aluno",      desc: "Continuar com a fila",              icone: "✦", destaque: false },
    ],
  },

  "pagamento.registado": {
    titulo: "Pagamento registado",
    subtitulo: (ctx) => `${ctx.valor} · ${ctx.nome} · ${ctx.mes}`,
    passos: [
      { id: "emitir_recibo",    label: "Emitir Recibo",               desc: "Comprovativo para o encarregado",   icone: "◉", destaque: true  },
      { id: "ver_atrasos",      label: "Ver alunos em atraso",        desc: "Continuar com cobranças pendentes", icone: "⚠", destaque: false },
      { id: "novo_pagamento",   label: "Registar outro pagamento",    desc: "Próximo encarregado",               icone: "◈", destaque: false },
    ],
  },

  "notas.lancadas.turma_completa": {
    titulo: "Turma completa",
    subtitulo: (ctx) => `${ctx.turma} · ${ctx.disciplina} · todas as notas lançadas`,
    passos: [
      { id: "gerar_minipauta",  label: "Gerar Mini-Pauta",            desc: "Relatório da turma para o director", icone: "◉", destaque: true  },
      { id: "proxima_turma",    label: "Lançar outra turma",          desc: "Continuar com pendentes",            icone: "✦", destaque: false },
    ],
  },

  "documento.emitido": {
    titulo: "Documento emitido",
    subtitulo: (ctx) => `${ctx.tipoDoc} · ${ctx.nome} · nº ${ctx.numero}`,
    passos: [
      { id: "imprimir",         label: "Imprimir agora",              desc: "Enviar para impressora",             icone: "◎", destaque: true  },
      { id: "outro_documento",  label: "Emitir outro documento",      desc: "Declaração, histórico, etc.",        icone: "◉", destaque: false },
      { id: "voltar_balcao",    label: "Voltar ao balcão",            desc: "Próximo encarregado",                icone: "✦", destaque: false },
    ],
  },

  "matricula.confirmada.lote": {
    titulo: "Lote confirmado",
    subtitulo: (ctx) => `${ctx.total} matrículas processadas em ${ctx.tempo}`,
    passos: [
      { id: "emitir_lote",      label: "Emitir boletins em lote",     desc: "Gerar todos de uma vez",             icone: "◉", destaque: true  },
      { id: "ver_lista",        label: "Ver lista de alunos",         desc: "Confirmar importação",               icone: "◎", destaque: false },
    ],
  },

  "isencao.aplicada": {
    titulo: "Isenção aplicada",
    subtitulo: (ctx) => `${ctx.desconto} · ${ctx.nome} · válida até ${ctx.validade}`,
    passos: [
      { id: "notificar",        label: "Notificar encarregado",       desc: "Informar sobre o desconto",          icone: "◎", destaque: true  },
      { id: "nova_isencao",     label: "Aplicar outra isenção",       desc: "Continuar com bolsas",               icone: "✦", destaque: false },
    ],
  },
};

export const ESTADOS_VAZIOS: Record<string, EstadoVazioConfig> = {
  "atrasos.nenhum": {
    icone: "ShieldCheck",
    titulo: "Saúde Financeira Plena",
    desc: "Parabéns! Todas as mensalidades da escola estão regularizadas hoje.",
    cor: "#64748b",
    bg: "transparent",
    border: "transparent",
  },
  "pautas.todas_assinadas": {
    icone: "FileCheck2",
    titulo: "Processos Concluídos",
    desc: "Não há pautas à espera de assinatura neste momento.",
    cor: "#64748b",
    bg: "transparent",
    border: "transparent",
  },
  "notificacoes.nenhuma": {
    icone: "Wind",
    titulo: "Horizonte Limpo",
    desc: "Não tens pendências por agora. Aproveita o fôlego.",
    cor: "#64748b",
    bg: "transparent",
    border: "transparent",
  },
  "alunos.lista_vazia": {
    icone: "Sparkles",
    titulo: "O ponto de partida",
    desc: "Ainda não tens alunos registados. Que tal começar agora?",
    cor: "#64748b",
    bg: "transparent",
    border: "transparent",
    acao: { label: "Começar Importação", id: "importar" },
  },
};
