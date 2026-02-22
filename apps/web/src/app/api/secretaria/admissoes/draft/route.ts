// apps/web/src/app/api/secretaria/admissoes/draft/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

const uuid = z.string().uuid();

const draftPayloadSchema = z
  .object({
    escolaId: uuid,
    candidaturaId: uuid.optional(),
    source: z.enum(["walkin", "online"]).default("walkin"),

    // Candidate fields (use stronger validation + normalization)
    nome_candidato: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .optional(),

    bi_numero: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .optional(),

    tipo_documento: z
      .string()
      .trim()
      .max(40)
      .optional(),

    numero_documento: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .optional(),

    telefone: z
      .string()
      .trim()
      .min(6)
      .max(32)
      .optional(),

    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    data_nascimento: z.string().trim().max(32).optional(),

    sexo: z.enum(["M", "F", "O", "N"]).optional(),

    nif: z
      .string()
      .trim()
      .max(64)
      .optional(),

    endereco: z
      .string()
      .trim()
      .max(200)
      .optional(),

    responsavel_nome: z
      .string()
      .trim()
      .max(160)
      .optional(),

    responsavel_contato: z
      .string()
      .trim()
      .max(32)
      .optional(),

    encarregado_email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    responsavel_financeiro_nome: z
      .string()
      .trim()
      .max(160)
      .optional(),

    responsavel_financeiro_nif: z
      .string()
      .trim()
      .max(64)
      .optional(),

    mesmo_que_encarregado: z.boolean().optional(),

    curso_id: uuid.optional(),
    classe_id: uuid.optional(),
    turma_preferencial_id: uuid.optional(),
  })
  .strict();

function normalizeCandidateData(input: z.infer<typeof draftPayloadSchema>) {
  // remove empty strings -> null (evita “unique” em string vazia e melhora consistência)
  const clean = { ...input } as any;

  const emptyToUndefined = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;

  for (const k of Object.keys(clean)) clean[k] = emptyToUndefined(clean[k]);

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
    const rpcArgs: any = {
      p_escola_id: escolaId,
      p_dados_candidato: candidateData,
      p_candidatura_id: candidaturaId ?? null,
    };

    const { data, error } = await supabase.rpc("admissao_upsert_draft", rpcArgs);

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
  } catch (e: any) {
    console.error("Error saving draft:", e);

    // mapeia unique violations sem chute
    if (e?.code === "23505") {
      const constraint = String(e?.constraint ?? "");
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
        details: { code: e?.code ?? null, message: e?.message ?? null },
      });
    } catch {}

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: e?.message ?? null,
        code: e?.code ?? null,
      },
      { status: 500 }
    );
  }
}
