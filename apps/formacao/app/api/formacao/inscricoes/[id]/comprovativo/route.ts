import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { InscricaoComprovativoTemplate, type InscricaoData } from "@/lib/pdf/templates/InscricaoComprovativo";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formando",
  "super_admin",
  "global_admin",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  const { data: fullData, error: fullError } = await s
    .from("formacao_inscricoes")
    .select(`
      id,
      created_at,
      status:estado,
      origem,
      modalidade,
      nome_snapshot,
      email_snapshot,
      bi_snapshot,
      telefone_snapshot,
      formando_user_id,
      escola_id,
      escola:escolas (
        nome,
        slug
      ),
      cohort:formacao_cohorts (
        codigo,
        nome,
        curso_nome,
        data_inicio,
        data_fim
      )
    `)
    .eq("id", id)
    .single();

  if (fullError || !fullData) {
    return NextResponse.json({ ok: false, error: "Erro ao carregar dados da inscrição" }, { status: 400 });
  }

  // Check de permissão para formando
  if (auth.role === "formando" && fullData.formando_user_id !== auth.userId) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const { data: fiscalBinding } = await s
    .from("fiscal_escola_bindings")
    .select("metadata, empresa_id")
    .eq("escola_id", fullData.escola_id)
    .eq("is_primary", true)
    .maybeSingle();

  const { data: fiscalEmpresa } = fiscalBinding?.empresa_id
    ? await s
        .from("fiscal_empresas")
        .select("nif, endereco, metadata")
        .eq("id", fiscalBinding.empresa_id)
        .maybeSingle()
    : { data: null };

  const bindingMetadata = (fiscalBinding?.metadata ?? null) as Record<string, unknown> | null;
  const empresaMetadata = (fiscalEmpresa?.metadata ?? null) as Record<string, unknown> | null;
  const fiscalTelefone =
    (typeof bindingMetadata?.telefone === "string" ? bindingMetadata.telefone : null) ??
    (typeof empresaMetadata?.telefone === "string" ? empresaMetadata.telefone : null);

  const pdfData: InscricaoData = {
    escola: {
      nome: fullData.escola?.nome || "Centro de Formação",
      nif: fiscalEmpresa?.nif || undefined,
      endereco: fiscalEmpresa?.endereco || undefined,
      telefone: fiscalTelefone || undefined,
    },
    formando: {
      nome: fullData.nome_snapshot || "N/A",
      email: fullData.email_snapshot || undefined,
      bi_numero: fullData.bi_snapshot || undefined,
      telefone: fullData.telefone_snapshot || undefined,
    },
    inscricao: {
      id: fullData.id,
      created_at: fullData.created_at,
      status: fullData.status,
      modalidade: fullData.modalidade,
      origem: fullData.origem,
    },
    cohort: {
      codigo: fullData.cohort?.codigo || "",
      nome: fullData.cohort?.nome || "",
      curso_nome: fullData.cohort?.curso_nome || "",
      data_inicio: fullData.cohort?.data_inicio || "",
      data_fim: fullData.cohort?.data_fim || "",
    },
  };

  try {
    const documentElement = createElement(InscricaoComprovativoTemplate, { data: pdfData });
    const buffer = await renderToBuffer(documentElement as React.ReactElement<DocumentProps>);
    const bytes = new Uint8Array(buffer);
    
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovativo-inscricao-${fullData.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF Generation Error:", err);
    return NextResponse.json({ ok: false, error: "Falha ao gerar PDF" }, { status: 500 });
  }
}
