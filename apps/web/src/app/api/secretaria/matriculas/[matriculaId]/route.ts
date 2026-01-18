import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH() {
  return NextResponse.json(
    { ok: false, error: "Endpoint de matrícula indisponível no momento." },
    { status: 501 }
  );
}
