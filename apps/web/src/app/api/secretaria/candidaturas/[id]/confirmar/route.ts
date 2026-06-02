export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return Response.json(
    {
      ok: false,
      error: "Rota legada removida. Use /api/secretaria/admissoes/convert.",
      candidatura_id: id,
    },
    { status: 410 }
  );
}
