import { DELETE as legacyDelete } from '@/app/api/secretaria/turmas/[id]/disciplinas/[disciplinaId]/route'

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; turmaId: string; disciplinaId: string }> }
) {
  const { turmaId, disciplinaId } = await ctx.params
  return legacyDelete(req, { params: Promise.resolve({ id: turmaId, disciplinaId }) })
}
