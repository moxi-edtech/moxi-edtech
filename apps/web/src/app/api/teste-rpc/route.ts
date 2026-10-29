import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Retired diagnostic endpoint: never return student records, RPC results or stack traces.
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Não encontrado' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
