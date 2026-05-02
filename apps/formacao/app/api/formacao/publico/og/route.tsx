import { ImageResponse } from 'next/og';
import { createClient } from "@supabase/supabase-js";

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return new Response('Slug required', { status: 400 });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnonKey = String(
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    ).trim();

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: schoolData } = await supabase
      .from('escolas')
      .select('nome, logo_url')
      .eq('slug', slug)
      .single();

    if (!schoolData) {
      return new Response('School not found', { status: 404 });
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020617',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)',
            padding: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '40px',
              padding: '60px',
              width: '90%',
              height: '80%',
            }}
          >
            {schoolData.logo_url ? (
              <img
                src={schoolData.logo_url}
                alt={schoolData.nome}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '24px',
                  marginBottom: '32px',
                  objectFit: 'cover',
                  border: '2px solid rgba(227, 178, 60, 0.5)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '24px',
                  backgroundColor: '#E3B23C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '64px',
                  fontWeight: '900',
                  color: '#020617',
                  marginBottom: '32px',
                }}
              >
                {schoolData.nome.charAt(0)}
              </div>
            )}
            <h1
              style={{
                fontSize: '64px',
                fontWeight: '900',
                color: 'white',
                textAlign: 'center',
                marginBottom: '16px',
                fontFamily: 'Sora, sans-serif',
              }}
            >
              {schoolData.nome}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(227, 178, 60, 0.15)',
                padding: '12px 24px',
                borderRadius: '100px',
                border: '1px solid rgba(227, 178, 60, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#E3B23C',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}
              >
                Inscrições Abertas 2026
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
