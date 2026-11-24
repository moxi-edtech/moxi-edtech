import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchImageBytes } from "@/lib/pdf/documentTemplate";
import type { AlunoListFilters } from "@/lib/schemas/aluno.schema";
import { InvalidAlunoFiltersError } from "@/lib/services/alunos.service";

/** Metadados institucionais da exportação, sempre resolvidos pelo tenant autorizado. */
export type AlunosPdfInstitutionalContext = {
  escola: string;
  anoLetivo: string;
  emissor: string;
  filtros: readonly string[];
  logoBytes?: Uint8Array;
};

function logoUrl(value: string | null): string | null {
  const raw = value?.trim();
  if (!raw || /(?:^|\/)insignia_med\.png(?:\?.*)?$/i.test(raw)) return null;

  const base = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  try {
    const resolved = base ? new URL(raw, base) : new URL(raw);
    // Não transferir cookies ou credenciais para domínios de imagens.
    if (resolved.protocol !== "https:" || resolved.username || resolved.password) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

type PdfContextOptions = {
  academicYearId?: string;
  emissor?: string;
};

export async function loadAlunosPdfInstitutionalContext(
  supabase: SupabaseClient,
  escolaId: string,
  filters: AlunoListFilters,
  options: PdfContextOptions = {}
): Promise<AlunosPdfInstitutionalContext> {
  // Não receber o nome da escola do cliente: usar apenas o tenant autorizado.
  const { data: escola, error: escolaError } = await supabase
    .from("escolas")
    .select("nome,logo_url")
    .eq("id", escolaId)
    .maybeSingle();

  if (escolaError) throw escolaError;
  if (!escola?.nome) throw new Error("Escola não encontrada para a emissão do documento.");

  let anoQuery = supabase
    .from("anos_letivos")
    .select("ano")
    .eq("escola_id", escolaId);

  if (options.academicYearId) {
    anoQuery = anoQuery.eq("id", options.academicYearId);
  } else if (filters.ano) {
    anoQuery = anoQuery.eq("ano", filters.ano);
  } else {
    anoQuery = anoQuery.eq("ativo", true);
  }

  const { data: ano, error: anoError } = await anoQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anoError) throw anoError;
  if (!ano || !Number.isInteger(Number(ano.ano))) {
    throw new InvalidAlunoFiltersError("Ano letivo não identificado. Selecione um ano letivo válido para exportar.");
  }
  const anoInicio = Number(ano.ano);
  const anoLetivo = `${anoInicio}/${anoInicio + 1}`;

  const [classeRes, turmaRes] = await Promise.all([
    filters.classeId
      ? supabase.from("classes").select("nome").eq("id", filters.classeId).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    filters.turmaId
      ? supabase.from("turmas").select("nome,ano_letivo").eq("id", filters.turmaId).eq("escola_id", escolaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (classeRes.error) throw classeRes.error;
  if (turmaRes.error) throw turmaRes.error;
  if (filters.classeId && !classeRes.data) throw new InvalidAlunoFiltersError("A classe selecionada não pertence a esta escola.");
  if (filters.turmaId && (!turmaRes.data || Number(turmaRes.data.ano_letivo) !== anoInicio)) {
    throw new InvalidAlunoFiltersError("A turma selecionada não pertence ao ano letivo atual. Reveja os filtros.");
  }

  const turno = filters.turno === "manha" ? "Manhã"
    : filters.turno === "tarde" ? "Tarde"
    : filters.turno === "noite" ? "Noite"
    : "Todos";

  const bolsa = filters.bolsa === "sim" ? "Bolseiros"
    : filters.bolsa === "nao" ? "Não bolseiros" : "Todos";

  let logoBytes: Uint8Array | undefined;
  const resolvedLogo = logoUrl(escola.logo_url);
  if (resolvedLogo) {
    try {
      const image = await fetchImageBytes(resolvedLogo);
      if (image.bytes.length <= 2_000_000) logoBytes = image.bytes;
    } catch {
      // Falha temporária do logótipo não bloqueia a emissão, tal como na lista nominal.
    }
  }

  return {
    escola: escola.nome,
    anoLetivo,
    emissor: options.emissor || "Sistema KLASSE",
    filtros: [
      `Ano letivo: ${anoLetivo}`,
      `Bolsa: ${bolsa}  |  Classe: ${classeRes.data?.nome ?? "Todas"}  |  Turma: ${turmaRes.data?.nome ?? "Todas"}  |  Turno: ${turno}`,
    ],
    logoBytes,
  };
}
