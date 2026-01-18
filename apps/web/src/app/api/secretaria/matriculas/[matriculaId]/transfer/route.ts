import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: "Transferência de matrícula indisponível no momento." },
    { status: 501 }
  );
}
