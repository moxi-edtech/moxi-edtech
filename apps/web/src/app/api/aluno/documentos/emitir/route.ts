import { checkBoletimAccess, BOLETIM_SERVICE_CODES, BOLETIM_SERVICE_CODE } from "@/lib/aluno/boletimAccess";
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAlunoContext } from '@/lib/alunoContext'
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from '@/lib/portalAlunoAuth'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  type: z.enum(['boletim', 'declaracao', 'cartao', 'ficha', 'historico', 'certificado']),
  studentId: z.string().uuid().optional(),
  serviceCode: z.string().trim().min(3).optional(),
})

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Contexto de aluno não encontrado', next_action: { type: 'contact_secretaria', label: 'Contactar a secretaria', href: '/aluno/avisos' } }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const { type, studentId, serviceCode } = parsed.data
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: (await supabase.auth.getUser()).data.user?.email })
    const alunoId = resolveSelectedStudentId({ selectedId: studentId ?? null, authorizedIds, fallbackId: ctx.alunoId })
    if (!alunoId) return NextResponse.json({ ok: false, error: 'Educando não autorizado', next_action: { type: 'contact_secretaria', label: 'Regularizar acesso', href: '/aluno/avisos' } }, { status: 403 })
    const { escolaId } = ctx
    const { data: matricula } = await supabase.from('matriculas').select('id, turma_id, ano_letivo').eq('escola_id', escolaId).eq('aluno_id', alunoId).in('status', ['ativa', 'ativo']).order('ano_letivo', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!matricula?.id) return NextResponse.json({ ok: false, error: 'O educando não possui matrícula activa', next_action: { type: 'contact_secretaria', label: 'Contactar a secretaria', href: '/aluno/avisos' } }, { status: 409 })
    const matriculaId = matricula.id
    const anoLetivo = matricula.ano_letivo

    // --- SEGURANÇA: Verificar se o aluno tem permissão (serviço pago/liberado) ---
    const resolvedServiceCode = serviceCode ?? (type === 'boletim' ? BOLETIM_SERVICE_CODE : 'DOC_DECLARACAO_FREQUENCIA');
    const supportedServiceCodes = new Set(['DOC_DECLARACAO_NOTAS', 'DOC_DECLARACAO_FREQUENCIA', 'DOC_BOLETIM_TRIMESTRAL', 'DOC_COMPROVANTE_MATRICULA', 'DOC_CARTAO_ESTUDANTE', 'DOC_FICHA_INSCRICAO', 'DOC_HISTORICO_ESCOLAR', 'DOC_CERTIFICADO_HABILITACOES']);
    if (!supportedServiceCodes.has(resolvedServiceCode)) {
      return NextResponse.json({ ok: false, error: 'Este serviço foi aprovado, mas a emissão digital ainda precisa ser concluída pela secretaria.', next_action: { type: 'contact_secretaria', label: 'Contactar a secretaria', href: '/aluno/avisos' } }, { status: 409 });
    }
    
    // O boletim mostra as notas actuais. Não reutilizar snapshots de documentos finais
    // nem deixar outro serviço gratuito autorizar notas através de `type=boletim`.
    if (type === 'boletim') {
      if (!BOLETIM_SERVICE_CODES.some((code) => code === resolvedServiceCode)) {
        return NextResponse.json({ ok: false, error: 'Serviço de boletim inválido.' }, { status: 400 });
      }
      const access = await checkBoletimAccess(supabase, { escolaId, alunoId, matriculaId });
      if (access.error) return NextResponse.json({ ok: false, error: 'Não foi possível verificar o pagamento.' }, { status: 503 });
      if (!access.granted) return NextResponse.json({ ok: false, error: 'Pague o boletim de notas e aguarde a confirmação da secretaria.' }, { status: 403 });
      return NextResponse.json({ ok: true, url: `/api/aluno/boletim/pdf?studentId=${encodeURIComponent(alunoId)}` });
    }
    if (BOLETIM_SERVICE_CODES.some((code) => code === resolvedServiceCode)) {
      return NextResponse.json({ ok: false, error: 'Este serviço só pode ser emitido como boletim.' }, { status: 400 });
    }

    const { data: permission, error: permError } = await supabase
      .from('servico_pedidos')
      .select('status')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .eq('matricula_id', matriculaId)
      .eq('servico_codigo', resolvedServiceCode)
      .eq('status', 'granted')
      .limit(1)
      .maybeSingle();

    if (permError) throw permError;
    
    if (!permission) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Acesso pendente. Confirme o pagamento do serviço para liberar o documento.',
        next_action: { type: 'pay_service', label: 'Abrir Secretaria Digital', href: '/aluno/documentos' }
      }, { status: 403 });
    }

    if (resolvedServiceCode === 'DOC_DECLARACAO_FREQUENCIA') {
      const { data: frequencyDoc, error: frequencyError } = await (supabase as any).rpc('aluno_emitir_declaracao_frequencia', {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_matricula_id: matriculaId,
      });
      if (frequencyError || !(frequencyDoc as any)?.docId) {
        console.error('Frequency document RPC error:', frequencyError);
        return NextResponse.json({ ok: false, error: 'Não foi possível emitir a declaração de frequência.' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, url: `/aluno/documentos/${(frequencyDoc as any).docId}/frequencia/print`, reused: Boolean((frequencyDoc as any).reused) });
    }
    if (resolvedServiceCode === 'DOC_COMPROVANTE_MATRICULA') {
      const { data: receiptDoc, error: receiptError } = await (supabase as any).rpc('aluno_emitir_comprovante_matricula', {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_matricula_id: matriculaId,
      });
      if (receiptError || !(receiptDoc as any)?.docId) {
        console.error('Enrollment proof RPC error:', receiptError);
        return NextResponse.json({ ok: false, error: 'Não foi possível emitir o comprovante de matrícula.' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, url: `/aluno/documentos/${(receiptDoc as any).docId}/comprovante-matricula/print`, reused: Boolean((receiptDoc as any).reused) });
    }
    if (resolvedServiceCode === 'DOC_CARTAO_ESTUDANTE' || resolvedServiceCode === 'DOC_FICHA_INSCRICAO') {
      const { data: operationalDoc, error: operationalError } = await (supabase as any).rpc('aluno_emitir_documento_operacional', {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_matricula_id: matriculaId,
        p_tipo_documento: resolvedServiceCode === 'DOC_CARTAO_ESTUDANTE' ? 'cartao_estudante' : 'ficha_inscricao',
      });
      if (operationalError || !(operationalDoc as any)?.docId) {
        console.error('Operational document RPC error:', operationalError);
        return NextResponse.json({ ok: false, error: 'Não foi possível emitir este documento.' }, { status: 500 });
      }
      const printType = resolvedServiceCode === 'DOC_CARTAO_ESTUDANTE' ? 'cartao' : 'ficha';
      return NextResponse.json({ ok: true, url: `/aluno/documentos/${(operationalDoc as any).docId}/${printType}/print`, reused: Boolean((operationalDoc as any).reused) });
    }
    if (resolvedServiceCode === 'DOC_HISTORICO_ESCOLAR' || resolvedServiceCode === 'DOC_CERTIFICADO_HABILITACOES') {
      const { data: finalDoc, error: finalError } = await (supabase as any).rpc('aluno_emitir_documento_final', {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_ano_letivo: Number(anoLetivo),
        p_tipo_documento: resolvedServiceCode === 'DOC_HISTORICO_ESCOLAR' ? 'historico' : 'certificado',
      });
      if (finalError || !(finalDoc as any)?.docId) {
        const message = finalError?.message?.includes('LEGAL_LOCK') ? 'O histórico anual ainda não foi fechado pela escola.' : 'Não foi possível emitir o documento final.';
        return NextResponse.json({ ok: false, error: message, next_action: { type: 'contact_secretaria', label: 'Falar com a secretaria', href: '/aluno/avisos' } }, { status: 409 });
      }
      const printType = resolvedServiceCode === 'DOC_HISTORICO_ESCOLAR' ? 'historico' : 'certificado';
      return NextResponse.json({ ok: true, url: `/aluno/documentos/${(finalDoc as any).docId}/${printType}/print`, reused: Boolean((finalDoc as any).reused) });
    }
    // ----------------------------------------------------------------------------

    if (type === 'declaracao') {
      const { data: comprovante, error: comprovanteError } = await supabase
        .from('documentos_emitidos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .eq('tipo', 'comprovante_matricula')
        .contains('dados_snapshot', { matricula_id: matriculaId })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (comprovanteError) {
        console.error('Comprovante lookup error:', comprovanteError)
        return NextResponse.json({ ok: false, error: 'Falha ao localizar comprovante de matrícula' }, { status: 500 })
      }

      if (!comprovante) {
        return NextResponse.json(
          { ok: false, error: 'O comprovante ainda não foi emitido pela secretaria.', next_action: { type: 'contact_secretaria', label: 'Contactar a secretaria', href: '/aluno/avisos' } },
          { status: 404 }
        )
      }

      return NextResponse.json({
        ok: true,
        url: `/aluno/documentos/${comprovante.id}/comprovante-matricula/print`,
      })
    }

    return NextResponse.json({ ok: false, error: 'A emissão deste serviço não está disponível.' }, { status: 409 })
  } catch (err: any) {
    console.error('Emit Doc API error:', err)
    return NextResponse.json({ ok: false, error: 'Erro interno ao emitir documento' }, { status: 500 })
  }
}
