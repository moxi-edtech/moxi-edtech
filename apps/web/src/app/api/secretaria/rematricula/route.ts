import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";

const RematriculaBodySchema = z.object({
  origin_turma_id: z.string().uuid(),
  destination_turma_id: z.string().uuid(),
  aluno_ids: z.array(z.string().uuid()).min(1),
  use_rpc: z.boolean().optional(),
  gerar_mensalidades: z.boolean().optional(),
  gerar_todas: z.boolean().optional(),
});

/**
 * Compatibilidade HTTP de rematrícula seletiva.
 *
 * O fallback anterior criava matrículas sem RAA transacional e classificava
 * origens como 'transferido'. O fast-path ignorava aluno_ids e podia deslocar
 * a turma inteira. Não há conversão segura de uma lista selecionada para
 * rematricula_em_massa; até existir RPC dedicada, falhar explicitamente.
 */
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 });

    const authz = await authorizeEscolaAction(supabase, escolaId, user.id, ["criar_matricula", "configurar_escola"]);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão." }, { status: 403 });

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/rematricula`);
    if (forwarded) return forwarded;

    const raw = await readJsonWithLimit(req, { maxBytes: 128 * 1024 });
    const parsed = RematriculaBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }

    return NextResponse.json({
      ok: false,
      code: "LIFECYCLE_CANONICAL_RAA_REQUIRED",
      error: "A rematrícula seletiva não pode ser concluída por esta rota legada. Para uma turma completa, use a confirmação oficial; para alunos selecionados, use o Balcão com validação académica e financeira.",
      next_action: "/secretaria/rematricula/confirmar",
      alternate_action: "/secretaria/balcao",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PayloadLimitError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Falha ao validar a rematrícula." }, { status: 503 });
  }
}
