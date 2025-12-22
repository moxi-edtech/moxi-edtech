import { notFound } from "next/navigation";
import Link from "next/link";
import {
  User,
  MapPin,
  Phone,
  Shield,
  GraduationCap,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { supabaseServer } from "@/lib/supabaseServer";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

type Dossier = {
  perfil: any;
  historico: any[];
  financeiro: any;
};

export default async function AlunoDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const escolaId =
    (user?.user_metadata as any)?.escola_id ||
    (user?.app_metadata as any)?.escola_id ||
    null;

  if (!user || !escolaId) return notFound();

  const { data: dossier, error } = await supabase.rpc<Dossier>(
    "get_aluno_dossier",
    {
      p_escola_id: escolaId,
      p_aluno_id: id,
    }
  );

  if (error || !dossier || !dossier.perfil) {
    console.error("Erro Dossiê:", error?.message || error);
    return notFound();
  }

  const { perfil, historico = [], financeiro = {} } = dossier;
  const mensalidades: any[] = Array.isArray(financeiro.mensalidades)
    ? financeiro.mensalidades
    : [];

  const dataNasc = perfil.data_nascimento
    ? new Date(perfil.data_nascimento)
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
          {perfil.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.foto_url}
              alt={perfil.nome_completo || perfil.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-10 w-10 text-gray-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {perfil.nome_completo || perfil.nome}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                perfil.status === "ativo"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {perfil.status || "—"}
            </span>
          </div>
          <p className="text-gray-500 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Proc: {perfil.numero_processo || "—"}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              BI: {perfil.bi_numero || "N/A"}
            </span>
            {dataNasc && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Nasc: {dataNasc.toLocaleDateString("pt-PT")}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/secretaria/alunos/${id}/editar`}
            className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition"
          >
            Editar Dados
          </Link>
          <Link
            href={`/secretaria/alunos/${id}/documentos`}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition"
          >
            Documentos
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Identidade */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
              Contatos & Família
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-0.5">
                  Encarregado
                </label>
                <div className="font-medium text-gray-800">
                  {perfil.encarregado_nome || perfil.responsavel || "Não informado"}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-0.5">
                  Telefone
                </label>
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4" />
                  {perfil.encarregado_telefone ||
                    perfil.telefone_responsavel ||
                    "—"}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-0.5">
                  Endereço
                </label>
                <div className="flex items-center gap-2 text-gray-700 text-sm">
                  <MapPin className="w-4 h-4" />
                  {perfil.endereco ||
                    perfil.endereco_bairro ||
                    perfil.provincia ||
                    perfil.provincia_residencia ||
                    "Não informado"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Central: Histórico */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Vida Acadêmica
            </h3>

            {historico.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhuma matrícula encontrada.
              </div>
            ) : (
              <div className="relative border-l border-gray-200 ml-2 space-y-6">
                {historico.map((mat: any, idx: number) => (
                  <div key={idx} className="ml-4 relative">
                    <div
                      className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        mat.status === "ativa" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-800 text-sm">
                          {mat.ano_letivo || "—"}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-white border rounded text-gray-500">
                          {mat.status || "—"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 font-medium mb-0.5">
                        {mat.turma || "Aguardando enturmação"}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        {mat.numero_matricula && (
                          <span>Mat.: {mat.numero_matricula}</span>
                        )}
                        {mat.turno && <span>{mat.turno}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Financeiro */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Situação Financeira
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="text-xs text-red-500 uppercase font-bold mb-1">
                  Dívida Atual
                </div>
                <div className="text-lg font-bold text-red-700">
                  {kwanza.format(financeiro.total_em_atraso ?? 0)}
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="text-xs text-green-500 uppercase font-bold mb-1">
                  Pago (Total)
                </div>
                <div className="text-lg font-bold text-green-700">
                  {kwanza.format(financeiro.total_pago ?? 0)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 block">
                Mensalidades Recentes
              </label>
              {mensalidades.slice(0, 5).map((fat: any) => (
                <div
                  key={fat.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100 transition text-sm"
                >
                  <div className="flex items-center gap-2">
                    {fat.status === "pago" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="text-gray-700 font-medium">
                      {new Date(0, (fat.mes ?? fat.mes_referencia ?? 1) - 1).toLocaleString(
                        "pt-PT",
                        { month: "short" }
                      )}
                      /{fat.ano ?? fat.ano_referencia}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-900 font-bold">
                      {kwanza.format(fat.valor ?? fat.valor_previsto ?? 0)}
                    </div>
                    {fat.vencimento || fat.data_vencimento ? (
                      <div className="text-[10px] text-gray-400">
                        Venc:{" "}
                        {new Date(fat.vencimento || fat.data_vencimento).toLocaleDateString(
                          "pt-PT",
                          { day: "2-digit", month: "2-digit" }
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {mensalidades.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-xs italic">
                  Nenhuma cobrança gerada.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t">
              <Link
                href={`/financeiro?aluno=${id}`}
                className="block w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver Extrato Completo →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
