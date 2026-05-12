// apps/web/src/app/api/secretaria/admissoes/convert/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireRoleInSchool } from '@/lib/authz';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { recordAuditServer } from '@/lib/audit';
import { emitirComprovanteMatricula } from '@/lib/documentos/emitirComprovanteMatricula';
// import { enqueueOutboxEvent } from '@/lib/outbox';

const convertPayloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  metodo_pagamento: z.enum(['TPA', 'CASH', 'TRANSFERENCIA']),
  comprovativo_url: z.string().url().optional(),
  amount: z.number().positive().optional(),
  parcial: z.boolean().optional(),
  referencia: z.string().trim().optional(),
  // ... other payment details
})

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractMatriculaIdFromConflict(text: string): string | null {
  const keyMatch = text.match(/matricula_id\)=\(\s*([0-9a-f-]{36})\s*\)/i);
  if (keyMatch?.[1]) return keyMatch[1];

  const messageMatch = text.match(/Matr[ií]cula\s+([0-9a-f-]{36})/i);
  if (messageMatch?.[1]) return messageMatch[1];

  const fallbackMatch = text.match(UUID_RE);
  return fallbackMatch?.[0] ?? null;
}

function isOfficialMatriculaStatus(status: unknown): boolean {
  return ["ativo", "ativa", "active"].includes(String(status ?? "").toLowerCase());
}

async function getFinalizedAdmissionResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidaturaId: string,
  escolaId: string | null
) {
  if (!escolaId) return null;

  const { data: candAfter } = await supabase
    .from("candidaturas")
    .select("status, matricula_id, aluno_id")
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  const statusAfter = String(candAfter?.status ?? "").toLowerCase();
  if (statusAfter !== "matriculado" || !candAfter?.matricula_id) return null;

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("numero_matricula")
    .eq("id", candAfter.matricula_id)
    .eq("escola_id", escolaId)
    .maybeSingle();

  return {
    ok: true,
    idempotent: true,
    message: "Matrícula já havia sido finalizada.",
    matricula_id: candAfter.matricula_id,
    aluno_id: candAfter.aluno_id,
    numero_matricula: (matricula?.numero_matricula as string | null) ?? null,
  };
}

async function getExistingMatriculaConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  escolaId: string | null,
  conflictText: string
) {
  const matriculaId = extractMatriculaIdFromConflict(conflictText);
  if (!matriculaId || !escolaId) return null;

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, aluno_id, turma_id, numero_matricula, ano_letivo, status")
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .maybeSingle();

  if (!matricula) return null;

  const { data: aluno } = await supabase
    .from("alunos")
    .select("id, nome, nome_completo, bi_numero, numero_documento, telefone")
    .eq("escola_id", escolaId)
    .eq("id", matricula.aluno_id)
    .maybeSingle();

  const { data: turma } = matricula.turma_id
    ? await supabase
        .from("turmas")
        .select("id, nome, turma_codigo, turno")
        .eq("escola_id", escolaId)
        .eq("id", matricula.turma_id)
        .maybeSingle()
    : { data: null };

  const { data: candidatura } = await supabase
    .from("candidaturas")
    .select("id, status, nome_candidato")
    .eq("escola_id", escolaId)
    .eq("matricula_id", matriculaId)
    .maybeSingle();

  return {
    matricula_id: matricula.id,
    aluno_id: matricula.aluno_id,
    numero_matricula: matricula.numero_matricula,
    ano_letivo: matricula.ano_letivo,
    status: matricula.status,
    aluno_nome: aluno?.nome_completo ?? aluno?.nome ?? null,
    aluno_documento: aluno?.numero_documento ?? aluno?.bi_numero ?? null,
    aluno_telefone: aluno?.telefone ?? null,
    turma_id: turma?.id ?? matricula.turma_id ?? null,
    turma_nome: turma?.nome ?? turma?.turma_codigo ?? null,
    turma_turno: turma?.turno ?? null,
    candidatura_id: candidatura?.id ?? null,
    candidatura_status: candidatura?.status ?? null,
    nome_candidato: candidatura?.nome_candidato ?? null,
  };
}

async function getCurrentAdmissionSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidaturaId: string,
  escolaId: string | null
) {
  if (!escolaId) return null;

  const { data: candidatura } = await supabase
    .from("candidaturas")
    .select("id, status, nome_candidato, dados_candidato")
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!candidatura) return null;

  const dados =
    candidatura.dados_candidato &&
    typeof candidatura.dados_candidato === "object" &&
    !Array.isArray(candidatura.dados_candidato)
      ? (candidatura.dados_candidato as Record<string, unknown>)
      : {};
  const pickString = (key: string) => {
    const value = dados[key];
    return typeof value === "string" && value.trim() ? value : null;
  };

  return {
    id: candidatura.id,
    status: candidatura.status ?? null,
    nome_candidato: candidatura.nome_candidato ?? null,
    documento: pickString("numero_documento") ?? pickString("bi_numero"),
    telefone: pickString("telefone") ?? pickString("responsavel_contato"),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const idempotencyKey = request.headers.get('idempotency-key');
  let escolaIdContext: string | null = null;
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
  }

  const body = await request.json()
  const validation = convertPayloadSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }
  
  const { candidatura_id, turma_id, metodo_pagamento, comprovativo_url, amount, parcial, referencia } = validation.data

  try {
    const { data: candidatura, error: candError } = await supabase
        .from('candidaturas')
        .select('escola_id, status, matricula_id, aluno_id')
        .eq('id', candidatura_id)
        .single();

    if (candError || !candidatura) {
        return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 });
    }

    escolaIdContext = candidatura.escola_id as string;
    const statusAtual = String(candidatura.status ?? "").toLowerCase();
    if (statusAtual === "matriculado" && candidatura.matricula_id) {
      let numeroMatricula: string | null = null;
      const { data: matricula } = await supabase
        .from("matriculas")
        .select("numero_matricula")
        .eq("id", candidatura.matricula_id)
        .eq("escola_id", candidatura.escola_id)
        .maybeSingle();
      numeroMatricula = (matricula?.numero_matricula as string | null) ?? null;

      return NextResponse.json({
        ok: true,
        idempotent: true,
        message: "Matrícula já havia sido finalizada.",
        matricula_id: candidatura.matricula_id,
        aluno_id: candidatura.aluno_id,
        numero_matricula: numeroMatricula,
      });
    }

  // 2. Authorize
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, candidatura.escola_id);
  if (!escolaId || escolaId !== candidatura.escola_id) {
    return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 });
  }

    const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: candidatura.escola_id,
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin', 'financeiro']
  });
    if (authError) return authError;

    // Idempotência canônica: se já temos resultado persistido para esta chave/scope, devolvemos.
    if (idempotencyKey) {
      const { data: existingIdempotency } = await (supabase as any)
        .from("idempotency_keys")
        .select("result")
        .eq("escola_id", escolaIdContext)
        .eq("scope", "admissao_finalizar_matricula")
        .eq("key", idempotencyKey)
        .maybeSingle();
      if (existingIdempotency?.result && typeof existingIdempotency.result === "object") {
        return NextResponse.json(existingIdempotency.result);
      }
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.current_escola_id || !profile?.escola_id) {
        await supabase
          .from("profiles")
          .update({
            current_escola_id: profile?.current_escola_id ?? candidatura.escola_id,
            escola_id: profile?.escola_id ?? candidatura.escola_id,
          })
          .eq("user_id", user.id);
      }
    } catch {}

    // 3. Chamada canónica: valida turma/preço e faz rascunho -> submetida -> aprovada -> matriculado numa transação.
    const { data, error } = await (supabase as any).rpc('admissao_finalizar_matricula', {
      p_escola_id: candidatura.escola_id,
      p_candidatura_id: candidatura_id,
      p_turma_id: turma_id,
      p_pagamento: {
        metodo_pagamento,
        comprovativo_url,
        amount,
        parcial,
        referencia,
      },
      p_idempotency_key: idempotencyKey,
      p_observacao: 'Finalização via Nova Admissão',
    })

    if (error) throw error

    const result = (data && typeof data === 'object' ? data : {}) as {
      matricula_id?: string | null
      numero_matricula?: string | null
      valor_matricula?: number | null
      valor_pago?: number | null
      status?: string | null
    }
    const matriculaId = typeof result.matricula_id === 'string' ? result.matricula_id : null

    recordAuditServer({
      escolaId: candidatura.escola_id,
      portal: 'secretaria',
      acao: 'ADMISSAO_CONVERTIDA_MATRICULA',
      entity: 'matriculas',
      entityId: matriculaId,
      details: { candidatura_id, turma_id, metodo_pagamento, referencia: referencia ?? null },
    }).catch(() => null)

    try {
      await (supabase as any).rpc('refresh_mv_turmas_para_matricula')
    } catch (refreshError) {
      console.warn('[admissoes/convert] refresh_mv_turmas_para_matricula failed:', refreshError)
    }
    let comprovante: { ok: boolean; printUrl?: string; error?: string } | null = null
    if (matriculaId) {
      const comprovanteResult = await emitirComprovanteMatricula({
        supabase,
        escolaId: candidatura.escola_id,
        matriculaId,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: {
          portal: "secretaria",
          acao: "COMPROVANTE_MATRICULA_AUTOEMITIDO",
        },
      })
      if (comprovanteResult.ok) {
        comprovante = { ok: true, printUrl: comprovanteResult.printUrl }
      } else {
        comprovante = { ok: false, error: comprovanteResult.error }
        console.warn('[admissoes/convert] comprovante não emitido:', comprovanteResult.error)
      }
    }

    return NextResponse.json({ ok: true, ...result, matricula_id: matriculaId, comprovante })
  } catch (error: unknown) {
    console.error('Error converting admission:', error)
    const isUniqueViolation =
      typeof error === 'object' &&
      error &&
      'code' in error &&
      (error as { code?: string }).code === '23505';
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: string }).message ?? '')
        : '';
    const errorDetails =
      typeof error === 'object' && error && 'details' in error
        ? String((error as { details?: string }).details ?? '')
        : '';
    const isAlreadyProcessedMessage =
      /this request has already been processed/i.test(errorMessage);
    const isIdempotencyUniqueViolation =
      isUniqueViolation &&
      /idempotency_keys|idempotency_keys_pkey|admissao_finalizar_matricula/i.test(`${errorMessage} ${errorDetails}`);

    if (isIdempotencyUniqueViolation || isAlreadyProcessedMessage) {
      // 1) Tenta recuperar resultado idempotente já gravado pela RPC.
      if (idempotencyKey && escolaIdContext) {
        const { data: existingIdempotency } = await (supabase as any)
          .from("idempotency_keys")
          .select("result")
          .eq("escola_id", escolaIdContext)
          .eq("scope", "admissao_finalizar_matricula")
          .eq("key", idempotencyKey)
          .maybeSingle();
        if (existingIdempotency?.result && typeof existingIdempotency.result === "object") {
          return NextResponse.json(existingIdempotency.result);
        }
      }

      // 2) Fallback: verifica estado final da candidatura/matrícula.
      const finalizedResult = await getFinalizedAdmissionResult(supabase, candidatura_id, escolaIdContext);
      if (finalizedResult) return NextResponse.json(finalizedResult);

      return NextResponse.json(
        {
          ok: false,
          error: "Operação duplicada detectada sem resultado persistido. A requisição original pode ainda estar em processamento.",
          code: "DUPLICATE_REQUEST_PENDING_STATE",
        },
        { status: 409 }
      );
    }
    if (isUniqueViolation) {
      const finalizedResult = await getFinalizedAdmissionResult(supabase, candidatura_id, escolaIdContext);
      if (finalizedResult) return NextResponse.json(finalizedResult);

      const conflictText = `${errorMessage} ${errorDetails}`;
      const existingMatricula = await getExistingMatriculaConflict(
        supabase,
        escolaIdContext,
        conflictText
      );

      if (
        existingMatricula &&
        !isOfficialMatriculaStatus(existingMatricula.status) &&
        /candidaturas_matricula_draft_conflict|rascunho de matr[ií]cula|Retome a candidatura/i.test(conflictText)
      ) {
        const currentCandidatura = await getCurrentAdmissionSnapshot(supabase, candidatura_id, escolaIdContext);

        return NextResponse.json(
          {
            ok: false,
            error: "Este aluno/documento já tem uma admissão em andamento. Retome o rascunho existente para finalizar a matrícula sem duplicar registos.",
            details: errorDetails || errorMessage || null,
            code: "ADMISSION_EXISTING_DRAFT",
            existing_matricula: existingMatricula,
            current_candidatura: currentCandidatura,
          },
          { status: 409 }
        );
      }

      if (
        existingMatricula &&
        /candidaturas_matricula_id_unique|matricula_id|Matr[ií]cula/i.test(conflictText)
      ) {
        const currentCandidatura = await getCurrentAdmissionSnapshot(supabase, candidatura_id, escolaIdContext);

        return NextResponse.json(
          {
            ok: false,
            error: "Este aluno/documento já tem matrícula finalizada neste ano letivo. Abra a matrícula existente ou corrija a candidatura duplicada.",
            details: errorDetails || errorMessage || null,
            code: "ADMISSION_ALREADY_MATRICULATED",
            existing_matricula: existingMatricula,
            current_candidatura: currentCandidatura,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Conflito de dados ao finalizar matrícula. Verifique se o aluno/documento já existe ou se já há matrícula no ano letivo.",
          details: errorDetails || errorMessage || null,
          code: "ADMISSION_CONSTRAINT_CONFLICT",
        },
        { status: 409 }
      );
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '42883') {
      const message = String((error as { message?: string }).message ?? '')
      const missingFunction = /confirmar_matricula_core/i.test(message)
      return NextResponse.json(
        {
          error: missingFunction
            ? 'Banco desatualizado: função confirmar_matricula_core não encontrada.'
            : 'Erro de compatibilidade no banco ao converter matrícula.',
          details: missingFunction
            ? 'Execute as migrations locais (ex: pnpm db:push ou pnpm db:reset) para criar a função.'
            : (error as { message?: string }).message ?? null,
          hint: missingFunction ? null : (error as { hint?: string }).hint ?? null,
          code: (error as { code?: string }).code ?? null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : null,
        code: typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code ?? null : null,
      },
      { status: 500 }
    )
  }
}
