import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  emitirDocumentoFiscalViaAdapter,
  resolveEmpresaFiscalAtiva,
} from '@/lib/fiscal/financeiroFiscalAdapter'
import type { Json } from '~types/supabase'

async function resolveEscolaId(
  s: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
) {
  const { data: prof } = await s
    .from('profiles' as any)
    .select('current_escola_id, escola_id')
    .eq('user_id', userId)
    .limit(1)
  let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as
    | string
    | undefined
  if (!escolaId) {
    const { data: vinc } = await s.from('escola_users').select('escola_id').eq('user_id', userId).limit(1)
    escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
  }
  return escolaId
}

export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const {
      aluno_id,
      item_id,
      quantidade,
      valor_unitario,
      desconto = 0,
      metodo_pagamento = 'numerario',
      descricao,
      status = 'pago',
    } = body || {}

    if (!aluno_id || !item_id) return NextResponse.json({ ok: false, error: 'Aluno e item são obrigatórios' }, { status: 400 })
    const qty = Number(quantidade)
    if (!qty || qty <= 0) return NextResponse.json({ ok: false, error: 'Quantidade inválida' }, { status: 400 })

    const { data, error } = await s.rpc('registrar_venda_avulsa', {
      p_escola_id: escolaId,
      p_aluno_id: aluno_id,
      p_item_id: item_id,
      p_quantidade: qty,
      p_valor_unit: Number(Number(valor_unitario ?? 0).toFixed(2)),
      p_desconto: Number(Number(desconto || 0).toFixed(2)),
      p_metodo_pagamento: metodo_pagamento,
      p_status: status,
      p_descricao: descricao,
      p_created_by: user.id,
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const vendaResult = (data as Array<{ id?: string }> | null)?.[0] ?? null
    const origin = new URL(req.url).origin
    const cookieHeader = req.headers.get("cookie")
    const origemId = String(vendaResult?.id ?? `${aluno_id}:${item_id}`)
    const empresaFiscalId = await resolveEmpresaFiscalAtiva({
      origin,
      escolaId,
      cookieHeader,
    })
    const totalVenda = Number(
      (Number(Number(valor_unitario ?? 0).toFixed(2)) * qty - Number(Number(desconto || 0).toFixed(2))).toFixed(2)
    )

    await s
      .from("financeiro_fiscal_links")
      .upsert(
        {
          escola_id: escolaId,
          empresa_id: empresaFiscalId,
          origem_tipo: "financeiro_itens_venda",
          origem_id: origemId,
          fiscal_documento_id: null,
          status: "pending",
          idempotency_key: `financeiro_itens_venda:${origemId}`,
          payload_snapshot: {
            origem_operacao: "financeiro_itens_venda",
            venda_id: vendaResult?.id ?? null,
            aluno_id,
            item_id,
            quantidade: qty,
            valor_total: totalVenda,
          } as Json,
          fiscal_error: null,
        },
        { onConflict: "origem_tipo,origem_id" }
      )
      .select("id")
      .maybeSingle()

    let fiscal:
      | {
          ok: true
          empresa_id: string
          tipo_documento: "FR" | "FT" | "RC"
          documento_id: string
          numero_formatado: string
          hash_control: string
          key_version: number
          payload_snapshot: Record<string, unknown>
        }
      | {
          ok: false
          error: string
        } = { ok: false, error: "Fiscal pendente." }

    try {
      const fiscalDoc = await emitirDocumentoFiscalViaAdapter({
        tipoFluxoFinanceiro: 'immediate_payment',
        origemOperacao: 'financeiro_itens_venda',
        origemId,
        descricaoPrincipal: descricao ?? 'Venda avulsa',
        itens: [
          {
            descricao: descricao ?? `Venda item ${item_id}`,
            valor: totalVenda > 0 ? totalVenda : Number(Number(valor_unitario ?? 0).toFixed(2)),
          },
        ],
        cliente: { nome: null, nif: null },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          venda_id: vendaResult?.id ?? null,
          aluno_id,
          item_id,
          quantidade: qty,
        },
      })

      fiscal = {
        ok: true,
        empresa_id: fiscalDoc.empresa_id,
        tipo_documento: fiscalDoc.tipo_documento,
        documento_id: fiscalDoc.documento_id,
        numero_formatado: fiscalDoc.numero_formatado,
        hash_control: fiscalDoc.hash_control,
        key_version: fiscalDoc.key_version,
        payload_snapshot: fiscalDoc.payload_snapshot,
      }
    } catch (fiscalError) {
      fiscal = {
        ok: false,
        error: fiscalError instanceof Error ? fiscalError.message : "Falha ao emitir documento fiscal.",
      }
    }

    if (fiscal.ok) {
      await s
        .from("financeiro_fiscal_links")
        .upsert(
          {
            escola_id: escolaId,
            empresa_id: fiscal.empresa_id,
            origem_tipo: "financeiro_itens_venda",
            origem_id: origemId,
            fiscal_documento_id: fiscal.documento_id,
            status: "ok",
            idempotency_key: `financeiro_itens_venda:${origemId}`,
            payload_snapshot: fiscal.payload_snapshot as Json,
            fiscal_error: null,
          },
          { onConflict: "origem_tipo,origem_id" }
        )
        .select("id")
        .maybeSingle()
    } else {
      await s
        .from("financeiro_fiscal_links")
        .upsert(
          {
            escola_id: escolaId,
            empresa_id: empresaFiscalId,
            origem_tipo: "financeiro_itens_venda",
            origem_id: origemId,
            fiscal_documento_id: null,
            status: "failed",
            idempotency_key: `financeiro_itens_venda:${origemId}`,
            payload_snapshot: {
              origem_operacao: "financeiro_itens_venda",
              erro: fiscal.error,
            } as Json,
            fiscal_error: fiscal.error,
          },
          { onConflict: "origem_tipo,origem_id" }
        )
        .select("id")
        .maybeSingle()
    }

    return NextResponse.json({
      ok: true,
      result: vendaResult,
      fiscal,
      status_fiscal: fiscal.ok ? "ok" : "pending",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
