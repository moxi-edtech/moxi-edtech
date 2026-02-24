// @kf2 allow-scan
// apps/web/src/app/api/seed-superadmin/route.ts
import { NextResponse } from "next/server";
import { callAuthAdminJob } from "@/lib/auth-admin-job";

const email = "superadmin@moxinexa.com";
const password = "12345678";
const nome = "Super Admin";

// early guard to avoid failing the build when env vars are missing
export async function GET(request: Request) {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SEED === "1";
  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "🚫 Rota desativada" },
      { status: 403 }
    );
  }

  try {
    const result = await callAuthAdminJob(request, "seedSuperAdmin", { email, password, nome });
    return NextResponse.json({
      ok: true,
      message: "✅ SuperAdmin recriado com sucesso!",
      email,
      password,
      userId: (result as any)?.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro seed-superadmin:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SEED === "1";
  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "🚫 Rota desativada" },
      { status: 403 }
    );
  }

  try {
    const result = await callAuthAdminJob(request, "seedSuperAdmin", { email, password, nome });
    return NextResponse.json({
      ok: true,
      message: "✅ SuperAdmin recriado com sucesso!",
      email,
      password,
      userId: (result as any)?.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro seed-superadmin:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}
