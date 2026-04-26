import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_ENDPOINT_GONE",
      error:
        "Endpoint legado descontinuado. Use o fluxo canônico com centro_slug + cohort_ref via /api/formacao/admissoes (self_service) ou action submeterCheckoutAction.",
    },
    { status: 410 }
  );
}
