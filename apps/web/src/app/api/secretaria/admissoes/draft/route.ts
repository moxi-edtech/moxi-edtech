// apps/web/src/app/api/secretaria/admissoes/draft/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import type { Json } from "~types/supabase";

const uuid = z.string().uuid();
const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalString = (schema: z.ZodString) =>
  z.preprocess(emptyStringToUndefined, schema.optional());
const optionalUuid = z.preprocess(emptyStringToUndefined, uuid.optional());
const optionalEmail = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().email().max(254).optional()
);
const optionalNumber = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyStringToUndefined, schema.optional());

const draftPayloadSchema = z
  .object({
    escolaId: uuid,
    candidaturaId: optionalUuid,
    source: z.enum(["walkin", "online"]).default("walkin"),

    // Candidate fields (use stronger validation + normalization)
    nome_candidato: optionalString(z.string().trim().min(2).max(160)),

    bi_numero: optionalString(z.string().trim().min(3).max(64)),

    tipo_documento: optionalString(z.string().trim().max(40)),

    numero_documento: optionalString(z.string().trim().min(3).max(64)),

    telefone: optionalString(z.string().trim().min(6).max(32)),

    email: optionalEmail,

    data_nascimento: optionalString(z.string().trim().max(32)),

    sexo: z.enum(["M", "F", "O", "N"]).optional(),

    nif: optionalString(z.string().trim().max(64)),

    endereco: optionalString(z.string().trim().max(200)),

    naturalidade: optionalString(z.string().trim().max(120)),

    provincia: optionalString(z.string().trim().max(120)),

    pai_nome: optionalString(z.string().trim().max(160)),

    mae_nome: optionalString(z.string().trim().max(160)),

    encarregado_relacao: optionalString(z.string().trim().max(120)),

    responsavel_nome: optionalString(z.string().trim().max(160)),

    responsavel_contato: optionalString(z.string().trim().max(32)),

    encarregado_email: optionalEmail,

    responsavel_financeiro_nome: optionalString(z.string().trim().max(160)),

    responsavel_financeiro_nif: optionalString(z.string().trim().max(64)),

    mesmo_que_encarregado: z.boolean().optional(),

    documentos: z.record(z.string()).optional(),
    campos_extras: z.record(z.unknown()).optional(),
    ano_letivo: optionalNumber(z.coerce.number().int()),

    percentagem_desconto: optionalNumber(z.number().min(0).max(100)),
    motivo_desconto: optionalString(z.string().trim().max(200)),

    curso_id: optionalUuid,
    classe_id: optionalUuid,
    turma_preferencial_id: optionalUuid,
  })
  .strict();

type DraftPayload = z.infer<typeof draftPayloadSchema>;
type DraftRpcArgs = {
  p_escola_id: string;
  p_dados_candidato: Json;
  p_candidatura_id?: string;
  p_source?: "walkin" | "online";
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function normalizeCandidateData(input: z.infer<typeof draftPayloadSchema>) {
  const clean: DraftPayload = { ...input };

  // normalizações úteis (ajuste conforme regras Angola)
  if (typeof clean.bi_numero === "string") {
    clean.bi_numero = clean.bi_numero.replace(/\s+/g, "").toUpperCase();
  }
  if (typeof clean.numero_documento === "string") {
    clean.numero_documento = clean.numero_documento.replace(/\s+/g, "").toUpperCase();
  }
  if (
    typeof clean.tipo_documento === "string" &&
    clean.tipo_documento.toUpperCase() === "BI" &&
    !clean.bi_numero &&
    typeof clean.numero_documento === "string"
  ) {
    clean.bi_numero = clean.numero_documento;
  }
  if (typeof clean.telefone === "string") {
    clean.telefone = clean.telefone.replace(/\s+/g, "");
  }
  if (typeof clean.responsavel_contato === "string") {
    clean.responsavel_contato = clean.responsavel_contato.replace(/\s+/g, "");
  }
  if (typeof clean.responsavel_financeiro_nif === "string") {
    clean.responsavel_financeiro_nif = clean.responsavel_financeiro_nif.replace(/\s+/g, "").toUpperCase();
  }
  if (typeof clean.email === "string") {
    clean.email = clean.email.toLowerCase();
  }
  if (typeof clean.encarregado_email === "string") {
    clean.encarregado_email = clean.encarregado_email.toLowerCase();
  }

  return clean;
}

const rpcReturnSchema = z.union([
  uuid, // função retorna UUID escalar
  z.array(z.object({ candidatura_id: uuid })).transform((rows) => rows[0]?.candidatura_id),
  z.object({ candidatura_id: uuid }).transform((o) => o.candidatura_id),
]);

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = draftPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const normalized = normalizeCandidateData(parsed.data);
  const { escolaId, candidaturaId, source, ...candidateData } = normalized;

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.current_escola_id || !profile?.escola_id) {
        await supabase
          .from("profiles")
          .update({
            current_escola_id: profile?.current_escola_id ?? escolaId,
            escola_id: profile?.escola_id ?? escolaId,
          })
          .eq("user_id", user.id);
      }
    }
  } catch {}

  try {
    if (candidateData.turma_preferencial_id && (!candidateData.curso_id || !candidateData.classe_id)) {
      const { data: turmaRow } = await supabase
        .from("turmas")
        .select("curso_id, classe_id, ano_letivo")
        .eq("id", candidateData.turma_preferencial_id)
        .eq("escola_id", escolaId)
        .maybeSingle();
      if (turmaRow?.curso_id && !candidateData.curso_id) {
        candidateData.curso_id = turmaRow.curso_id;
      }
      if (turmaRow?.classe_id && !candidateData.classe_id) {
        candidateData.classe_id = turmaRow.classe_id;
      }
      if (turmaRow?.ano_letivo && !candidateData.ano_letivo) {
        candidateData.ano_letivo = turmaRow.ano_letivo;
      }
    }

    const rpcArgs: DraftRpcArgs = {
      p_escola_id: escolaId,
      p_dados_candidato: toJson(candidateData),
      p_candidatura_id: candidaturaId,
      p_source: source,
    };

    let { data, error } = await supabase.rpc("admissao_upsert_draft", rpcArgs);

    if (error) {
      const message = String(error.message ?? "");
      if (message.includes("Candidatura não encontrada")) {
        const { p_candidatura_id: _ignored, ...retryArgs } = rpcArgs;
        const retry = await supabase.rpc("admissao_upsert_draft", retryArgs);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) throw error;

    const candidatura_id = rpcReturnSchema.parse(data);

    // Audit (evitar PII completa; guarda só chaves e metadados)
    await recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "admissao.draft.upsert",
      entity: "admissao_candidaturas",
      entityId: candidatura_id,
      details: {
        source,
        has_email: !!candidateData.email,
        has_telefone: !!candidateData.telefone,
        has_bi: !!candidateData.bi_numero,
      },
    });

    return NextResponse.json({ ok: true, candidatura_id }, { status: 200 });
  } catch (e: unknown) {
    console.error("Error saving draft:", e);
    const errorCode = typeof e === "object" && e !== null && "code" in e ? String(e.code) : null;
    const errorMessage = e instanceof Error ? e.message : null;
    const errorConstraint = typeof e === "object" && e !== null && "constraint" in e ? String(e.constraint) : "";

    // mapeia unique violations sem chute
    if (errorCode === "23505") {
      const constraint = errorConstraint;
      const field =
        constraint.includes("bi") ? "bi_numero" :
        constraint.includes("email") ? "email" :
        constraint.includes("telefone") ? "telefone" :
        "unique";

      return NextResponse.json(
        { error: "Duplicate draft", field },
        { status: 409 }
      );
    }

    // opcional: auditar falha (sem PII)
    try {
      await recordAuditServer({
        escolaId,
        portal: "secretaria",
        acao: "admissao.draft.upsert_failed",
        entity: "admissao_candidaturas",
        details: { code: errorCode, message: errorMessage },
      });
    } catch {}

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}
