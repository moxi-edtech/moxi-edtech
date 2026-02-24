"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfigHealthBanner from "@/components/system/ConfigHealthBanner";
import { SchoolsHeader } from "./SchoolsHeader";
import { SchoolsFilters } from "./SchoolsFilters";
import { SchoolsTable } from "./SchoolsTable";
import { SchoolsPagination } from "./SchoolsPagination";
import type { SchoolsTableProps, School, OnboardingProgress, EditForm } from "./types";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { useToast } from "@/components/feedback/FeedbackSystem";

const BillingModal = dynamic(() => import("@/components/super-admin/SchoolBillingModal"))
const ConfirmModal = dynamic(() => import("@/components/super-admin/ConfirmActionModal"))

export default function SchoolsTableClient({ 
  initialSchools, 
  initialProgress, 
  initialErrorMsg, 
  fallbackSource 
}: SchoolsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { success, error } = useToast();

  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialErrorMsg ?? null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [planFilter, setPlanFilter] = useState<"all" | string>("all");
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>(initialProgress);
  const [billingOpen, setBillingOpen] = useState(false)
  const [billingSchoolId, setBillingSchoolId] = useState<string | number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{ action: 'suspend' | 'reactivate' | 'delete' | null; escolaId: string | number | null; escolaNome: string }>({ action: null, escolaId: null, escolaNome: '' })
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'done' | 'in_progress' | 'step1' | 'step2' | 'step3'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [saving, setSaving] = useState<string | number | null>(null);
  const itemsPerPage = 10;

  // ... (mantém as funções existentes como runRepair, reload, handleRetry, etc.)
  // ... (mas agora delegando para os componentes menores)

  // Helpers
  const normalizeStr = (s: string | null | undefined) => (s || "").toLowerCase();

  // Reload data from server APIs
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // List of schools
      const listRes = await fetch('/api/super-admin/escolas/list', { cache: 'no-store' });
      const listJson = await listRes.json().catch(() => ({ ok: false }));
      if (!listRes.ok || !listJson?.ok || !Array.isArray(listJson.items)) {
        throw new Error((listJson && listJson.error) || 'Falha ao recarregar escolas.');
      }

      // Normalize like server page.tsx does
      const prettyPlan = (p?: string | null): string => PLAN_NAMES[parsePlanTier(p)];

      type RawSchool = { id: string; nome: string | null; status: string | null; plano: string | null; last_access: string | null; total_alunos: number; total_professores: number; cidade: string | null; estado: string | null };
      const normalized: School[] = (listJson.items as RawSchool[]).map(d => ({
        id: String(d.id),
        name: d.nome ?? 'Sem nome',
        status: (d.status ?? 'ativa') as string,
        plan: prettyPlan(d.plano),
        lastAccess: d.last_access ?? null,
        students: Number(d.total_alunos ?? 0),
        teachers: Number(d.total_professores ?? 0),
        city: d.cidade ?? '',
        state: d.estado ?? '',
        email: '',
        telefone: '',
        responsavel: '',
      }));
      setSchools(normalized);

      // Progress map
      const progRes = await fetch('/api/super-admin/escolas/onboarding/progress', { cache: 'no-store' });
      const progJson = await progRes.json().catch(() => ({ ok: false }));
      if (progRes.ok && progJson?.ok && Array.isArray(progJson.items)) {
        const map: Record<string, OnboardingProgress> = {};
        for (const it of progJson.items as any[]) map[String(it.escola_id)] = it as OnboardingProgress;
        setProgress(map);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      error('Erro ao recarregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const shouldAutoLoad = initialSchools.length === 0 || Boolean(initialErrorMsg);
    if (!shouldAutoLoad) return;
    reload();
  }, [initialSchools.length, initialErrorMsg, reload]);

  const handleRetry = () => {
    reload();
  };

  // Derived data: filters and pagination
  const filteredSchools = useMemo(() => {
    const term = normalizeStr(searchTerm);
    return schools.filter((s) => {
      const matchesTerm = !term || normalizeStr(s.name).includes(term) || normalizeStr(s.city).includes(term) || normalizeStr(s.responsavel).includes(term);
      const matchesStatus = statusFilter === 'all' || String(s.status) === statusFilter;
      const matchesPlan = planFilter === 'all' || String(s.plan) === planFilter;
      const prog = progress[String(s.id)];
      const matchesOnboarding = onboardingFilter === 'all'
        ? true
        : onboardingFilter === 'done'
          ? Boolean(prog?.onboarding_finalizado)
          : onboardingFilter === 'in_progress'
            ? !prog?.onboarding_finalizado
            : onboardingFilter === 'step1'
              ? (Number(prog?.last_step ?? 1) === 1)
              : onboardingFilter === 'step2'
                ? (Number(prog?.last_step ?? 1) === 2)
                : (Number(prog?.last_step ?? 1) === 3);
      return matchesTerm && matchesStatus && matchesPlan && matchesOnboarding;
    });
  }, [schools, searchTerm, statusFilter, planFilter, onboardingFilter, progress]);

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / itemsPerPage));
  const paginatedSchools = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSchools.slice(start, start + itemsPerPage);
  }, [filteredSchools, currentPage]);

  const totalStudents = useMemo(() => filteredSchools.reduce((acc, s) => acc + Number(s.students || 0), 0), [filteredSchools]);
  const totalTeachers = useMemo(() => filteredSchools.reduce((acc, s) => acc + Number(s.teachers || 0), 0), [filteredSchools]);
  const onboardingSummary = useMemo(() => {
    let done = 0, inProgress = 0;
    for (const s of filteredSchools) {
      const p = progress[String(s.id)];
      if (p?.onboarding_finalizado) done++; else inProgress++;
    }
    return { done, inProgress };
  }, [filteredSchools, progress]);

  const handlePageChange = (page: number) => {
    const next = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(next);
    // sync URL query param for page
    try {
      const sp = new URLSearchParams(searchParams?.toString());
      if (next === 1) sp.delete('page'); else sp.set('page', String(next));
      const query = sp.toString();
      if (pathname) {
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
    } catch {}
  };

  // Navigation handlers
  const viewSchoolDetails = (schoolId: string | number) => {
    router.push(`/super-admin/escolas/${schoolId}/edit`);
  };

  const enterSchoolPortal = (schoolId: string | number) => {
    router.push(`/escola/${schoolId}/admin/dashboard`);
  };

  // Admin repair action
  const runRepair = async (dryRun: boolean) => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/escolas/admins/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok) throw new Error((json && json.error) || 'Falha ao reparar admins');
      success(dryRun ? 'Dry‑run concluído' : 'Admins reparados com sucesso');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      error('Erro ao reparar admins');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (school: School) => {
    setEditingId(school.id);
    setEditForm({
      name: school.name,
      email: school.email,
      telefone: school.telefone,
      responsavel: school.responsavel,
      status: school.status,
      plan: school.plan,
      city: school.city,
      state: school.state,
    });
  };

  const handleSave = async (schoolId: string | number) => {
    try {
      setSaving(schoolId);
      setErrorMsg(null);

      const unPrettyPlan = (p?: string | null): PlanTier => parsePlanTier(p);

      const { plan, ...rest } = editForm;
      const planTier = unPrettyPlan(plan);
      const updates = { ...rest, plano: planTier };

      const res = await fetch(`/api/super-admin/escolas/${schoolId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || 'Falha ao atualizar escola');

      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, ...editForm } : s));
      setEditingId(null);
      setEditForm({});
      success('Escola atualizada com sucesso.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      error('Erro ao atualizar escola');
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg(null);
  };

  const handleInputChange = (field: keyof School, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value === "" ? null : value }));
  };

  // ... (resto das funções e useMemos)

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfigHealthBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error Message Component */}
        {errorMsg && <ErrorMessage errorMsg={errorMsg} loading={loading} onRetry={handleRetry} />}

        <SchoolsHeader 
          fallbackSource={fallbackSource}
          onRepairAdmins={runRepair}
          loading={loading}
        />

        <SchoolsFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          planFilter={planFilter}
          onPlanFilterChange={setPlanFilter}
          totalStudents={totalStudents}
          totalTeachers={totalTeachers}
          onboardingSummary={onboardingSummary}
        />

        <SchoolsTable
          schools={paginatedSchools}
          progress={progress}
          loading={loading}
          editingId={editingId}
          editForm={editForm}
          saving={saving}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onInputChange={handleInputChange}
          onViewDetails={viewSchoolDetails}
          onEnterPortal={enterSchoolPortal}
          onSendBilling={(schoolId) => { setBillingSchoolId(schoolId); setBillingOpen(true); }}
          onSuspend={(school) => { setConfirmData({ action: 'suspend', escolaId: school.id, escolaNome: school.name }); setConfirmOpen(true); }}
          onDelete={(school) => { setConfirmData({ action: 'delete', escolaId: school.id, escolaNome: school.name }); setConfirmOpen(true); }}
        />

        <SchoolsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Modais */}
      {billingOpen && billingSchoolId != null && (
        <BillingModal 
          escolaId={billingSchoolId} 
          onClose={() => { setBillingOpen(false); setBillingSchoolId(null); }} 
        />
      )}

      {confirmOpen && confirmData.action && confirmData.escolaId != null && (
        <ConfirmModal
          action={confirmData.action}
          escolaId={confirmData.escolaId}
          escolaNome={confirmData.escolaNome}
          onClose={() => setConfirmOpen(false)}
          onChanged={(newStatus, mode) => {
            if (confirmData.action === 'delete') {
              setSchools(prev => prev.filter(s => s.id !== confirmData.escolaId));
            } else if (newStatus) {
              setSchools(prev => prev.map(s => s.id === confirmData.escolaId ? { ...s, status: newStatus } : s));
            }
          }}
        />
      )}
    </div>
  );
}

// Componente de erro separado
function ErrorMessage({ errorMsg, loading, onRetry }: { errorMsg: string; loading: boolean; onRetry: () => void }) {
  return (
    <div className="mb-4 p-4 rounded-md border border-red-200 bg-red-50 text-red-800 flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold">Ocorreu um erro</p>
        <p className="text-sm mt-1 break-words">{errorMsg}</p>
      </div>
      <Button onClick={onRetry} disabled={loading} tone="red" size="sm">Tentar novamente</Button>
    </div>
  );
}
