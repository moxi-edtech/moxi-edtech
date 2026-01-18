// apps/web/src/app/api/secretaria/admissoes/save_for_later/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { recordAuditServer } from '@/lib/audit'
import { requireRoleInSchool } from '@/lib/authz'
import ReactPDF, { type DocumentProps } from '@react-pdf/renderer'
import { FichaInscricaoPDF } from '@/components/secretaria/FichaInscricaoPDF';
import type { ReactElement } from 'react'
import { createElement } from 'react'

export const runtime = 'nodejs';

const saveForLaterPayloadSchema = z.object({
  candidatura_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json()
  const validation = saveForLaterPayloadSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { candidatura_id } = validation.data
  
  try {
    const { data: cand, error: candError } = await supabase
        .from('candidaturas')
        .select('*, cursos(nome), classes(nome)')
        .eq('id', candidatura_id)
        .single();

    if (candError || !cand) {
        return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 });
    }

  // 2. Authorize
  const { error: authError } = await requireRoleInSchool({ 
    supabase, 
    escolaId: cand.escola_id, 
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_escola_id, escola_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.current_escola_id || !profile?.escola_id) {
          await supabase
            .from("profiles")
            .update({
              current_escola_id: profile?.current_escola_id ?? cand.escola_id,
              escola_id: profile?.escola_id ?? cand.escola_id,
            })
            .eq("user_id", user.id);
        }
      }
    } catch {}

    const candAny = cand as any;
    const status = String(candAny?.status ?? '').toLowerCase();

    if (status === 'matriculado' || status === 'rejeitada') {
      return NextResponse.json({ error: 'Candidatura já finalizada' }, { status: 409 });
    }

    // Idempotency / Race-condition prevention
    if (candAny.ficha_pdf_path && candAny.expires_at && new Date(candAny.expires_at) > new Date()) {
      const { data: signedUrlData } = await supabase.storage
        .from('fichas-inscricao')
        .createSignedUrl(candAny.ficha_pdf_path, 3600);
      return NextResponse.json({ ok: true, pdf_url: signedUrlData?.signedUrl, pdf_path: candAny.ficha_pdf_path, replay: true });
    }

    if (status !== 'rascunho' && !candAny.ficha_pdf_path) {
      return NextResponse.json(
        { error: 'Candidatura já submetida; não é possível gerar nova ficha.' },
        { status: 409 }
      );
    }

    const pdfPath = `${cand.escola_id}/${candidatura_id}.pdf`;
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 48);

    const { data: claimed, error: claimErr } = await supabase
      .from('candidaturas')
      .update({
        expires_at: expires_at.toISOString(),
        ficha_pdf_path: pdfPath,
      } as any)
      .eq('id', candidatura_id)
      .eq('escola_id', cand.escola_id)
      .is('ficha_pdf_path' as any, null) // Optimistic lock
      .select('id')
      .maybeSingle();

    if (claimErr) throw claimErr;

    if (claimed && status === 'rascunho') {
      const { error: submitErr } = await supabase.rpc('admissao_submit', {
        p_escola_id: cand.escola_id,
        p_candidatura_id: candidatura_id,
        p_source: 'walkin'
      });

      if (submitErr) {
        return NextResponse.json({ error: submitErr.message }, { status: 400 });
      }
    }

    if (claimed) {
        // This request won the race. Generate and upload the PDF.
        const pdfComponent = createElement(
          FichaInscricaoPDF,
          { candidatura: cand as any }
        ) as unknown as ReactElement<DocumentProps>;
        const pdfStream = await ReactPDF.renderToStream(pdfComponent);

        const { error: uploadError } = await supabase.storage
            .from('fichas-inscricao')
            .upload(pdfPath, pdfStream, { 
                upsert: true,
                contentType: 'application/pdf',
                cacheControl: '3600',
            });
        if (uploadError) throw uploadError;

        await recordAuditServer({
          escolaId: cand.escola_id,
          portal: 'secretaria',
          acao: 'ADMISSION_RESERVED_48H',
          entity: 'candidaturas',
          entityId: cand.id,
        });

    } 
    // If 'claimed' is null, another request won the race. We just need to get the signed URL.
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('fichas-inscricao')
        .createSignedUrl(pdfPath, 60 * 60);

    if (signedUrlError) {
        throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    return NextResponse.json({ ok: true, pdf_url: signedUrlData.signedUrl, pdf_path: pdfPath, replay: !claimed });

  } catch (error: any) {
    console.error('Error saving for later:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error?.message ?? null,
        code: error?.code ?? null,
      },
      { status: 500 }
    )
  }
}
