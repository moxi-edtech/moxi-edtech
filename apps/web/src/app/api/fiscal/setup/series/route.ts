import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "FISCAL_LOCAL_SERIES_CREATION_DISABLED",
        message:
          "Criação local de séries fiscais foi descontinuada. Use o fluxo de provisionamento AGT.",
        provisioning_endpoint: "/api/fiscal/provisioning/series",
      },
    },
    { status: 410 }
  );
}
