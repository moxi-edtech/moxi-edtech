import { NextResponse } from "next/server";
import { callAuthAdminJob } from "@/lib/auth-admin-job";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const codigo = (body?.codigo || "").toString().trim();
    const bi = (body?.bi || "").toString().trim();

    if (!codigo || !bi) {
      return NextResponse.json({ ok: false, error: "Informe código e BI" }, { status: 400 });
    }

    const result = await callAuthAdminJob(req, "activateStudentAccess", { codigo, bi });
    const login = (result as any)?.login as string | undefined;
    return NextResponse.json({ ok: true, login });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
