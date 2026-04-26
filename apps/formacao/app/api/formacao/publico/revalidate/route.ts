import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = String(process.env.FORMACAO_PUBLIC_REVALIDATE_SECRET ?? "").trim();
  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = String(body?.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Slug inválido" }, { status: 400 });
  }

  revalidatePath(`/${slug}`);
  return NextResponse.json({ ok: true, revalidated: `/${slug}` });
}
