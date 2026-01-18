import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: "Atualização de status indisponível no momento." },
    { status: 501 }
  );
}
