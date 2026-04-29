import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO" },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO" },
    { status: 410 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { ok: false, error: "ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO" },
    { status: 410 }
  );
}
