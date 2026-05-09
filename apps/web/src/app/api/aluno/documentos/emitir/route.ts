import { NextResponse } from 'next/server'
import { z } from 'zod'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { getAlunoContext } from '@/lib/alunoContext'
import { supabaseServerRole } from '@/lib/supabaseServerRole'
import { notaParaExtensoPTAO } from '@/lib/academico/extenso'
import { BoletimBatchV1, type BoletimSnapshot } from '@/templates/pdf/ministerio/BoletimBatchV1'
import { DeclaracaoMatriculaV1, type DeclaracaoMatriculaSnapshot } from '@/templates/pdf/ministerio/DeclaracaoMatriculaV1'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  type: z.enum(['boletim', 'declaracao']),
})

const buildQrDataUrl = (value: string) =>
  `https://quickchart.io/qr?text=${encodeURIComponent(value)}&margin=1&size=240`

interface DocSnapshot {
  aluno_nome?: string
  turma_nome?: string | null
  ano_letivo?: number | string | null
  media_final?: number | null
  media_extenso?: string | null
  escola_nome?: string
  aluno_bi?: string | null
  curso_nome?: string
  classe_nome?: string
  diretora_nome?: string | null
}

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId || !ctx.matriculaId) {
      return NextResponse.json({ ok: false, error: 'Contexto de aluno não encontrado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const { type } = parsed.data
    const { escolaId, alunoId, matriculaId, anoLetivo } = ctx

    // 1. Emitir Documento (RPC para gerar Snapshot/Hash)
    const tipoDocRpc = type === 'boletim' ? 'declaracao_notas' : 'declaracao_matricula'
    const { data: docRes, error: emitError } = await supabase.rpc('emitir_documento_final', {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_ano_letivo: Number(anoLetivo),
      p_tipo_documento: tipoDocRpc,
    })

    const docResult = docRes as { docId: string } | null

    if (emitError || !docResult || !docResult.docId) {
      console.error('Emit RPC error:', emitError)
      return NextResponse.json({ ok: false, error: 'Falha ao processar documento no sistema' }, { status: 500 })
    }

    const docId = docResult.docId

    // 2. Buscar Snapshot gerado
    const { data: row, error: lookupError } = await supabase
      .from('documentos_emitidos')
      .select('dados_snapshot, hash_validacao')
      .eq('id', docId)
      .maybeSingle()

    if (lookupError || !row) {
      return NextResponse.json({ ok: false, error: 'Documento não localizado após emissão' }, { status: 404 })
    }

    const snapshotBase = (row.dados_snapshot || {}) as DocSnapshot
    const hash = row.hash_validacao || 'OFFICIAL-VALID-HASH'
    const qrCode = buildQrDataUrl(hash)

    let element: ReactElement<DocumentProps>

    if (type === 'boletim') {
      // Para o Boletim, precisamos das notas reais da view
      const { data: turmaDisciplinas } = await supabase
        .from('turma_disciplinas')
        .select(`
          id, 
          conta_para_media_med, 
          curso_matriz:curso_matriz_id(
            disciplina_id, 
            disciplinas_catalogo:disciplina_id(nome)
          )
        `)
        .eq('escola_id', escolaId)
        .eq('turma_id', ctx.turmaId || '')

      const tdMap = new Map<string, { nome: string; conta: boolean; disciplina_id: string | null }>()
      for (const td of turmaDisciplinas || []) {
        interface MatrixData {
          disciplina_id: string | null
          disciplinas_catalogo: { nome: string } | null
        }
        const matrix = td.curso_matriz as unknown as MatrixData
        tdMap.set(td.id, {
          nome: matrix?.disciplinas_catalogo?.nome ?? 'Disciplina',
          conta: td.conta_para_media_med !== false,
          disciplina_id: matrix?.disciplina_id ?? null,
        })
      }

      const { data: boletimRows } = await supabase
        .from('vw_boletim_por_matricula')
        .select('turma_disciplina_id, trimestre, nota_final')
        .eq('escola_id', escolaId)
        .eq('matricula_id', matriculaId)

      const notasByDisciplina = new Map<string, { t1?: number | null; t2?: number | null; t3?: number | null }>()
      interface BoletimRow {
        turma_disciplina_id: string
        trimestre: number
        nota_final: number | null
      }
      for (const rowNota of (boletimRows || []) as unknown as BoletimRow[]) {
        const td = tdMap.get(rowNota.turma_disciplina_id)
        if (!td?.disciplina_id) continue
        const current = notasByDisciplina.get(td.disciplina_id) ?? {}
        const tri = Number(rowNota.trimestre)
        if (tri === 1) current.t1 = rowNota.nota_final
        if (tri === 2) current.t2 = rowNota.nota_final
        if (tri === 3) current.t3 = rowNota.nota_final
        notasByDisciplina.set(td.disciplina_id, current)
      }

      const disciplinas = Array.from(tdMap.values()).map((disc) => {
        const notas = disc.disciplina_id ? notasByDisciplina.get(disc.disciplina_id) : undefined
        return {
          nome: disc.nome,
          conta_para_media_med: disc.conta,
          t1: notas?.t1 ?? null,
          t2: notas?.t2 ?? null,
          t3: notas?.t3 ?? null,
        }
      })

      const mediaFinal = typeof snapshotBase.media_final === 'number' ? snapshotBase.media_final : null
      const boletimSnapshot: BoletimSnapshot = {
        aluno_nome: snapshotBase.aluno_nome || '—',
        turma_nome: snapshotBase.turma_nome || '—',
        ano_letivo: snapshotBase.ano_letivo || anoLetivo || '—',
        media_final: mediaFinal,
        media_extenso: snapshotBase.media_extenso ?? (typeof mediaFinal === 'number' ? notaParaExtensoPTAO(mediaFinal) : null),
        hash_validacao: hash,
        qrCodeDataUrl: qrCode,
        disciplinas,
      }

      element = createElement(BoletimBatchV1, { snapshots: [boletimSnapshot] }) as unknown as ReactElement<DocumentProps>
    } else {
      // Declaração de Matrícula
      const decSnapshot: DeclaracaoMatriculaSnapshot = {
        escola_nome: snapshotBase.escola_nome || '—',
        aluno_nome: snapshotBase.aluno_nome || '—',
        aluno_bi: snapshotBase.aluno_bi || '—',
        curso_nome: snapshotBase.curso_nome || '—',
        classe_nome: snapshotBase.classe_nome || '—',
        turma_nome: snapshotBase.turma_nome || '—',
        ano_letivo: snapshotBase.ano_letivo || anoLetivo || '—',
        data_emissao: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        hash_validacao: hash,
        qrCodeDataUrl: qrCode,
        diretora_nome: snapshotBase.diretora_nome || null,
      }

      element = createElement(DeclaracaoMatriculaV1, { snapshot: decSnapshot }) as unknown as ReactElement<DocumentProps>
    }

    // 3. Renderizar PDF
    const buffer = await renderToBuffer(element)

    // 4. Salvar no Supabase Storage (Privileged)
    const adminSupabase = supabaseServerRole()
    const fileName = `${type}_${Date.now()}.pdf`
    const filePath = `${escolaId}/${alunoId}/${fileName}`

    const { error: uploadError } = await adminSupabase.storage
      .from('documentos_emitidos')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload storage error:', uploadError)
      return NextResponse.json({ ok: false, error: 'Falha ao arquivar documento gerado' }, { status: 500 })
    }

    // 5. Obter URL Pública
    const { data: { publicUrl } } = adminSupabase.storage
      .from('documentos_emitidos')
      .getPublicUrl(filePath)

    // 6. O registro do documento já possui o public_id, que é usado para resolver o arquivo no bucket.
    // Não há coluna storage_path na tabela documentos_emitidos.

    return NextResponse.json({ ok: true, url: publicUrl })

  } catch (err: any) {
    console.error('Emit Doc API error:', err)
    return NextResponse.json({ ok: false, error: 'Erro interno ao emitir documento' }, { status: 500 })
  }
}
