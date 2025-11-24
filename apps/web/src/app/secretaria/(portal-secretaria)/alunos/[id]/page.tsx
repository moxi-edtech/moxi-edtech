"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import AuditPageView from "@/components/audit/AuditPageView";
import { ArrowLeftIcon, UserIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

type AlunoDetails = {
  id: string;
  escola_id: string | null;
  profile_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  numero_login?: string | null;
  status?: string | null;
  responsavel: string | null;
  telefone_responsavel: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  bi_numero: string | null;
  naturalidade: string | null;
  provincia: string | null;
  encarregado_relacao: string | null;
  created_at?: string | null;
};

export default function AlunoDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = useMemo(() => String(params?.id ?? ""), [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aluno, setAluno] = useState<AlunoDetails | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!alunoId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar aluno");
        if (active) setAluno(json.item as AlunoDetails);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [alunoId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="aluno_detail" entityId={alunoId} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-moxinexa-teal transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-moxinexa-teal flex items-center justify-center">
            <UserIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-moxinexa-dark">Detalhes do aluno</h1>
            <p className="text-moxinexa-gray">Visualize os dados cadastrais</p>
          </div>
          <div className="ml-auto flex gap-2">
            {aluno && (
              <Link href={`/secretaria/alunos/${aluno.id}/editar`}>
                <Button tone="teal" size="sm">
                  <PencilSquareIcon className="w-4 h-4" /> Editar
                </Button>
              </Link>
            )}
            {aluno && (
              <Button tone="red" size="sm" onClick={() => setShowDeleteModal(true)}>
                Arquivar
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          {loading ? (
            <div>Carregando…</div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : aluno ? (
            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-semibold text-moxinexa-dark mb-3">Dados pessoais</h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <Field label="Nome" value={aluno.nome} />
                  <Field label="Email" value={aluno.email ?? '—'} />
                  <Field label="Telefone" value={aluno.telefone ?? '—'} />
                  <Field label="Número de login" value={aluno.numero_login ?? '—'} />
                  <Field label="Status" value={aluno.status ?? '—'} />
                  <Field label="Data de nascimento" value={aluno.data_nascimento ?? '—'} />
                  <Field label="Sexo" value={aluno.sexo ?? '—'} />
                  <Field label="BI" value={aluno.bi_numero ?? '—'} />
                  <Field label="Naturalidade" value={aluno.naturalidade ?? '—'} />
                  <Field label="Província" value={aluno.provincia ?? '—'} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-moxinexa-dark mb-3">Encarregado</h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <Field label="Relação" value={aluno.encarregado_relacao ?? '—'} />
                  <Field label="Nome do responsável" value={aluno.responsavel ?? '—'} />
                  <Field label="Telefone do responsável" value={aluno.telefone_responsavel ?? '—'} />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {showDeleteModal && aluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Arquivar aluno</h2>
            <p className="mt-2 text-sm text-gray-600">
              Tem certeza que deseja arquivar o aluno <span className="font-semibold">{aluno.nome}</span>?
              <br />Ele deixará de aparecer nas listagens principais, mas permanecerá no histórico da escola.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Motivo da exclusão (obrigatório)</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm"
                placeholder="Ex.: Aluno transferido para outra escola, cadastro duplicado, etc."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                tone="gray"
                onClick={() => { setShowDeleteModal(false); setDeleteReason(""); }}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                tone="red"
                onClick={async () => {
                  if (!deleteReason.trim()) { alert('Por favor, informe o motivo da exclusão.'); return; }
                  try {
                    setDeleting(true);
                    const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(aluno.id)}/delete`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: deleteReason.trim() }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao arquivar aluno');
                    setShowDeleteModal(false);
                    router.push('/secretaria/alunos');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : String(e));
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
              >
                {deleting ? 'Arquivando…' : 'Confirmar arquivamento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
