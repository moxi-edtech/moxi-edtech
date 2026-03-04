import { NextResponse } from "next/server";
import { verifyActivationToken } from "@/lib/activationLink";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const withNoStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return withNoStore(NextResponse.json({ ok: false, error: "Token ausente" }, { status: 400 }));
  }

  const payload = verifyActivationToken(token);
  if (!payload) {
    return withNoStore(NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 }));
  }

  return withNoStore(NextResponse.json({ ok: true, escola: payload.escola_nome }));
}
