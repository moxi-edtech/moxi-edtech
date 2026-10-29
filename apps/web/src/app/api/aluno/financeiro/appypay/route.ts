import { NextResponse } from 'next/server';
import { getAlunoContext } from '@/lib/alunoContext';
import { resolveSelectedStudentId } from '@/lib/portalAlunoAuth';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { PaymentError, configForSchool } from '@/lib/server/payments/providers/appypay/core';
import { boundedBody, callPortalBroker, uuid, type PortalCommand } from '@/lib/server/payments/providers/appypay/portal-broker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store' };
async function handle(request: Request) {
  try {
    if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new PaymentError(403, 'Origem inválida');
    const input = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : JSON.parse(await boundedBody(request));
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['action', 'studentId', 'targetId', 'kind', 'expectedAmount', 'referenceId'].includes(key))) throw new PaymentError(400, 'Pedido inválido');
    const action = input.action;
    if (request.method === 'GET' ? !['status', 'preview'].includes(action) : !['issue', 'check'].includes(action)) throw new PaymentError(400, 'Ação inválida');
    if (input.studentId !== undefined && (typeof input.studentId !== 'string' || !uuid.test(input.studentId))) throw new PaymentError(400, 'Aluno inválido');
    if (action !== 'status' && (typeof input.targetId !== 'string' || !uuid.test(input.targetId) || !['monthly', 'service'].includes(input.kind))) throw new PaymentError(400, 'Débito inválido');
    if (action === 'issue' && (typeof input.expectedAmount !== 'number' || !Number.isFinite(input.expectedAmount) || input.expectedAmount <= 0 || Number(input.expectedAmount.toFixed(2)) !== input.expectedAmount)) throw new PaymentError(400, 'Consulte o valor antes de emitir');
    if (action === 'check' && (typeof input.referenceId !== 'string' || !uuid.test(input.referenceId))) throw new PaymentError(400, 'Referência inválida');
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId) throw new PaymentError(401, 'Não autenticado');
    if (input.studentId && !ctx.alunoIds.includes(input.studentId)) throw new PaymentError(403, 'Aluno não autorizado');
    const studentId = resolveSelectedStudentId({ selectedId: input.studentId ?? null, authorizedIds: ctx.alunoIds, fallbackId: ctx.alunoId });
    const schoolId = await resolveEscolaIdForUser(supabase, ctx.userId, ctx.escolaId);
    if (!studentId || schoolId !== ctx.escolaId) throw new PaymentError(403, 'Vínculo não autorizado');
    // Recheck ownership through the authenticated RPC as well as the portal context. No privileged key in this human endpoint.
    const { data: allowed, error } = await supabase.rpc('portal_user_can_access_aluno', { p_aluno_id: studentId });
    if (error || !allowed) throw new PaymentError(403, 'Aluno não autorizado');
    const config = configForSchool(process.env.APPYPAY_CONFIG, schoolId);
    const command: PortalCommand = { action, schoolId, studentId, actorId: ctx.userId,
      kind: input.kind, targetId: input.targetId, expectedAmount: input.expectedAmount, referenceId: input.referenceId };
    const result = await callPortalBroker(command, config);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, enabled: false, error: error instanceof PaymentError ? error.message : 'Pagamento indisponível; consulte o estado' },
      { status: error instanceof PaymentError ? error.status : error instanceof SyntaxError ? 400 : 503, headers });
  }
}
export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
