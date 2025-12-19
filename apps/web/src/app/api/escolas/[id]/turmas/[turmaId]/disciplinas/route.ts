import { GET as legacyGet } from '@/app/api/secretaria/turmas/[id]/disciplinas/route'

export async function GET(req: Request, ctx: { params: Promise<{ id: string; turmaId: string }> }) {
  const { turmaId } = await ctx.params
  return legacyGet(req, { params: Promise.resolve({ id: turmaId }) })
}
