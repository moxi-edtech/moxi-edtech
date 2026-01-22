import { NextResponse } from "next/server";
import { getFechoCaixaData } from "@/lib/financeiro/fecho";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const operadorId = searchParams.get("operador_id");

  const result = await getFechoCaixaData({ date, operadorId });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
