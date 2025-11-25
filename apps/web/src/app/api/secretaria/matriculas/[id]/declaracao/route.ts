import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { createInstitutionalPdf } from "@/lib/pdf/documentTemplate"
import { buildSignatureLine, createQrImage } from "@/lib/pdf/qr"

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: matricula_id } = await context.params

    const { data: matricula, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        alunos(*, profiles!alunos_profile_id_fkey(*)),
        turmas(*, school_sessions(*)),
        escolas(*)
      `)
      .eq('id', matricula_id)
      .single()

    if (error || !matricula) {
      return NextResponse.json({ ok: false, error: 'Matrícula não encontrada' }, { status: 404 })
    }

    const aluno = Array.isArray((matricula as any).alunos)
      ? (matricula as any).alunos[0]
      : (matricula as any).alunos
    const profile = aluno?.profiles ? (Array.isArray(aluno.profiles) ? aluno.profiles[0] : aluno.profiles) : null
    const turma = (matricula as any).turmas
    const escola = (matricula as any).escolas

    const verificationToken = randomUUID()
    const validationBase = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? escola?.validation_base_url

    const pdfBytes = await createInstitutionalPdf({
      title: 'Declaração de Matrícula',
      school: {
        name: escola?.nome ?? 'Escola',
        nif: escola?.nif ?? escola?.numero_fiscal,
        address: escola?.endereco ?? escola?.morada,
        contacts: [escola?.telefone, escola?.email].filter(Boolean).join(' • '),
        logoUrl: escola?.logo_url ?? escola?.logo,
        validationBaseUrl: validationBase ?? undefined,
      },
      verificationToken,
      content: async ({ page, font, boldFont, margin, contentStartY, verificationUrl, pdfDoc, width }) => {
        let cursorY = contentStartY
        const lineHeight = 16

        const draw = (text: string, isBold = false, size = 12) => {
          page.drawText(text, { x: margin, y: cursorY, font: isBold ? boldFont : font, size })
          cursorY -= lineHeight
        }

        const birthDate = profile?.data_nascimento
          ? new Date(profile.data_nascimento).toLocaleDateString('pt-BR')
          : '—'
        const nif = profile?.nif || aluno?.nif || '—'
        const bi = profile?.bi_numero || aluno?.bi_numero || '—'
        const turno = turma?.turno || turma?.periodo || '—'

        draw('Dados do aluno', true, 13)
        draw(`Nome: ${aluno?.nome ?? '—'}`)
        draw(`Documento: ${bi}`)
        draw(`Data de nascimento: ${birthDate}`)
        if (nif && nif !== '—') {
          draw(`NIF: ${nif}`)
        }

        cursorY -= lineHeight / 2
        draw('Dados acadêmicos', true, 13)
        draw(`Curso: ${turma?.curso ?? turma?.nome_curso ?? '—'}`)
        draw(`Classe/Série: ${turma?.classe ?? '—'}`)
        draw(`Turma: ${turma?.nome ?? turma?.codigo ?? '—'}`)
        draw(`Turno: ${turno}`)
        draw(`Ano letivo: ${turma?.school_sessions?.nome ?? turma?.school_sessions?.ano ?? '—'}`)

        cursorY -= lineHeight
        draw(
          `Declaramos, para os devidos fins, que o(a) aluno(a) ${aluno?.nome ?? '________________'}, encontra-se regularmente matriculado(a) na turma ${turma?.nome ?? '____'}, no ano letivo de ${turma?.school_sessions?.nome ?? turma?.school_sessions?.ano ?? '____'}.`
        )

        cursorY -= lineHeight
        const qrSize = 90
        const qrImage = await createQrImage(pdfDoc, `${verificationUrl}`)
        const qrX = width - margin - qrSize
        const qrY = Math.max(cursorY - qrSize - lineHeight, margin + 40)
        page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

        const signatureY = qrY + qrSize + 10
        page.drawText(buildSignatureLine({ signerName: escola?.responsavel ?? escola?.diretor_nome, signerRole: escola?.diretor_cargo }), {
          x: margin,
          y: signatureY,
          font,
          size: 12,
        })
      },
    })

    const buffer = Buffer.from(pdfBytes)
    const blob = new Blob([buffer], { type: 'application/pdf' })

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="declaracao_matricula_${aluno?.nome ?? 'aluno'}.pdf"`,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
