import { POST as legacyPost } from '@/app/api/secretaria/turmas/[id]/atribuir-professor/route'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; turmaId: string }> }
) {
  const { turmaId } = await ctx.params
  return legacyPost(req, { params: Promise.resolve({ id: turmaId }) })
}
