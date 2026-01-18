import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Exportação de matrículas indisponível no momento." },
    { status: 501 }
  );
}
