import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO" },
    { status: 410 }
  );
}
