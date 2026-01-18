// apps/web/src/app/api/secretaria/candidaturas/[id]/confirmar/route.ts
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return new NextResponse(
        JSON.stringify({ 
            ok: false, 
            error: "DEPRECATED: use /api/secretaria/admissoes/convert via Wizard" 
        }),
        { 
            status: 410,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}