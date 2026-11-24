import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// The legacy endpoint cannot create or provision fiscal series.
// A separate certified provisioning flow is required; do not restore this path.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "FISCAL_SERIE_LEGACY_DISABLED",
        message: "Criação de séries fiscais indisponível durante a certificação. Nenhuma série foi criada.",
        details: null,
      },
    },
    { status: 410 },
  );
}
