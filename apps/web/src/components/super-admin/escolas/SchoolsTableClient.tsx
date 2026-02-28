"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import ConfigHealthBanner from "@/components/system/ConfigHealthBanner";

import { SchoolsHeader } from "./SchoolsHeader";
import { SchoolsFilters } from "./SchoolsFilters";
import { SchoolsTable } from "./SchoolsTable";
import { SchoolsPagination } from "./SchoolsPagination";

import type { EditForm, OnboardingProgress, School, SchoolsTableProps } from "./types";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";

const BillingModal = dynamic(() => import("@/components/super-admin/SchoolBillingModal"));
const ConfirmModal = dynamic(() => import("@/components/super-admin/ConfirmActionModal"));

type StatusFilter = "all" | string;
type PlanFilter = "all" | string;
type OnboardingFilter = "all" | "done" | "in_progress" | "step1" | "step2" | "step3";

type ConfirmState = {
  open: boolean;
  action: "suspend" | "reactivate" | "delete" | null;
  escolaId: string | null;
  escolaNome: string;
};

function normalizeStr(s: string | null | undefined) {
  return (s || "").toLowerCase();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function prettyPlan(p?: string | null): string {
  return PLAN_NAMES[parsePlanTier(p)];
}

export default function SchoolsTableClient({
  initialSchools,
  initialProgress,
  initialErrorMsg,
  fallbackSource,
}: SchoolsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ---------- Data state ----------
  const [schools, setSchools] = useState<School[]>(() =>
    (initialSchools ?? []).map((s) => ({ ...s, id: String(s.id) }))
  );
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>(() => {
    const m: Record<string, OnboardingProgress> = {};
    for (const [k, v] of Object.entries(initialProgress ?? {})) m[String(k)] = v;
    return m;
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialErrorMsg ?? null);

  // ---------- UI state ----------
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [onboardingFilter, setOnboardingFilter] = useState<OnboardingFilter>("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingSchoolId, setBillingSchoolId] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    action: null,
    escolaId: null,
    escolaNome: "",
  });

  const itemsPerPage = 10;

  // Read initial page from query
  const initialPage = useMemo(() => {
    const raw = searchParams?.get("page");
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once

  const [currentPage, setCurrentPage] = useState(initialPage);

  // Abort controller for reload
  const acRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    try {
      setLoading(true);
      setErrorMsg(null);

      // Admin data should not be force-cached. We want fresh.
      const listRes = await fetch("/api/super-admin/escolas/list", {
        cache: "no-store",
        signal: ac.signal,
      });

      const listJson = await listRes.json().catch(() => ({ ok: false }));
      if (!listRes.ok || !listJson?.ok || !Array.isArray(listJson.items)) {
        throw new Error(listJson?.error || "Falha ao recarregar escolas.");
      }

      type RawSchool = {
        id: string;
        nome: string | null;
        status: string | null;
        plano: string | null;
        last_access: string | null;
        total_alunos: number;
        total_professores: number;
        cidade: string | null;
        estado: string | null;
      };

      const normalized: School[] = (listJson.items as RawSchool[]).map((d) => ({
        id: String(d.id),
        name: d.nome ?? "Sem nome",
        status: (d.status ?? "ativa") as string,
        plan: prettyPlan(d.plano),
        lastAccess: d.last_access ?? null,
        students: Number(d.total_alunos ?? 0),
        teachers: Number(d.total_professores ?? 0),
        city: d.cidade ?? "",
        state: d.estado ?? "",
        email: "",
        telefone: "",
        responsavel: "",
      }));

      setSchools(normalized);

      const progRes = await fetch("/api/super-admin/escolas/onboarding/progress", {
        cache: "no-store",
        signal: ac.signal,
      });

      const progJson = await progRes.json().catch(() => ({ ok: false }));
      if (progRes.ok && progJson?.ok && Array.isArray(progJson.items)) {
        const map: Record<string, OnboardingProgress> = {};
        for (const it of progJson.items as any[]) map[String(it.escola_id)] = it as OnboardingProgress;
        setProgress(map);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error("Erro ao recarregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const shouldAutoLoad = (initialSchools?.length ?? 0) === 0 || Boolean(initialErrorMsg);
    if (!shouldAutoLoad) return;
    reload();

    return () => {
      acRef.current?.abort();
    };
  }, [initialSchools?.length, initialErrorMsg, reload]);

  const handleRetry = () => reload();

  // Derived: filters
  const filteredSchools = useMemo(() => {
    const term = normalizeStr(searchTerm);

    return schools.filter((s) => {
      const matchesTerm =
        !term ||
        normalizeStr(s.name).includes(term) ||
        normalizeStr(s.city).includes(term) ||
        normalizeStr(s.responsavel).includes(term);

      const matchesStatus = statusFilter === "all" || String(s.status) === statusFilter;
      const matchesPlan = planFilter === "all" || String(s.plan) === planFilter;

      const prog = progress[String(s.id)];
      const matchesOnboarding =
        onboardingFilter === "all"
          ? true
          : onboardingFilter === "done"
            ? Boolean(prog?.onboarding_finalizado)
            : onboardingFilter === "in_progress"
              ? !prog?.onboarding_finalizado
              : onboardingFilter === "step1"
                ? Number(prog?.last_step ?? 1) === 1
                : onboardingFilter === "step2"
                  ? Number(prog?.last_step ?? 1) === 2
                  : Number(prog?.last_step ?? 1) === 3;

      return matchesTerm && matchesStatus && matchesPlan && matchesOnboarding;
    });
  }, [schools, searchTerm, statusFilter, planFilter, onboardingFilter, progress]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSchools.length / itemsPerPage)),
    [filteredSchools.length]
  );

  // Keep currentPage in range if filters shrink
  useEffect(() => {
    setCurrentPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const paginatedSchools = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSchools.slice(start, start + itemsPerPage);
  }, [filteredSchools, currentPage]);

  const totalStudents = useMemo(
    () => filteredSchools.reduce((acc, s) => acc + Number(s.students || 0), 0),
    [filteredSchools]
  );
  const totalTeachers = useMemo(
    () => filteredSchools.reduce((acc, s) => acc + Number(s.teachers || 0), 0),
    [filteredSchools]
  );

  const onboardingSummary = useMemo(() => {
    let done = 0;
    let inProgress = 0;

    for (const s of filteredSchools) {
      const p = progress[String(s.id)];
      if (p?.onboarding_finalizado) done++;
      else inProgress++;
    }
    return { done, inProgress };
  }, [filteredSchools, progress]);

  const syncPageToUrl = useCallback(
    (page: number) => {
      try {
        const sp = new URLSearchParams(searchParams?.toString());
        if (page === 1) sp.delete("page");
        else sp.set("page", String(page));
        const query = sp.toString();
        const base = pathname ?? "/";
        router.replace(query ? `${base}?${query}` : base);
      } catch {
        // noop
      }
    },
    [router, pathname, searchParams]
  );

  const handlePageChange = (page: number) => {
    const next = clamp(page, 1, totalPages);
    setCurrentPage(next);
    syncPageToUrl(next);
  };

  // Navigation
  const viewSchoolDetails = (schoolId: string) => router.push(`/super-admin/escolas/${schoolId}/edit`);
  const enterSchoolPortal = (schoolId: string) => router.push(`/escola/${schoolId}/admin/dashboard`);

  // Admin repair
  const runRepair = async (dryRun: boolean) => {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/escolas/admins/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao reparar admins");
      toast.success(dryRun ? "Dry-run concluído" : "Admins reparados com sucesso");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error("Erro ao reparar admins");
    } finally {
      setLoading(false);
    }
  };

  // Editing
  const handleEdit = (school: School) => {
    setEditingId(String(school.id));
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

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg(null);
  };

  const handleInputChange = (field: keyof School, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value === "" ? null : value }));
  };

  const handleSave = async (schoolIdRaw: string) => {
    const schoolId = String(schoolIdRaw);
    try {
      setSavingId(schoolId);
      setErrorMsg(null);

      const unPrettyPlan = (p?: string | null): PlanTier => parsePlanTier(p);
      const { plan, ...rest } = editForm;

      const updates = {
        ...rest,
        plano: unPrettyPlan(plan),
      };

      const res = await fetch(`/api/super-admin/escolas/${schoolId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !result.ok) throw new Error(result?.error || "Falha ao atualizar escola");

      setSchools((prev) => prev.map((s) => (String(s.id) === schoolId ? { ...s, ...editForm } : s)));
      setEditingId(null);
      setEditForm({});
      toast.success("Escola atualizada com sucesso!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error("Erro ao atualizar escola");
    } finally {
      setSavingId(null);
    }
  };

  // Modals
  const openBilling = (schoolId: string) => {
    setBillingSchoolId(String(schoolId));
    setBillingOpen(true);
  };

  const openConfirm = (action: ConfirmState["action"], school: School) => {
    setConfirm({
      open: true,
      action,
      escolaId: String(school.id),
      escolaNome: school.name,
    });
  };

  const closeConfirm = () => setConfirm((c) => ({ ...c, open: false }));

  return (
    <div className="min-h-screen bg-slate-950">
      <ConfigHealthBanner />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header + Status */}
        <div className="rounded-xl bg-slate-900 ring-1 ring-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            {errorMsg ? (
              <ErrorBanner errorMsg={errorMsg} loading={loading} onRetry={handleRetry} />
            ) : null}

            <SchoolsHeader fallbackSource={fallbackSource} onRepairAdmins={runRepair} loading={loading} />
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 rounded-xl bg-slate-900 ring-1 ring-white/10 p-4 sm:p-5">
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
        </div>

        {/* Table */}
        <div className="mt-4 rounded-xl bg-slate-900 ring-1 ring-white/10 overflow-hidden">
          <SchoolsTable
            schools={paginatedSchools}
            progress={progress}
            loading={loading}
            editingId={editingId}
            editForm={editForm}
            saving={savingId}
            onEdit={handleEdit}
            onSave={(id) => handleSave(String(id))}
            onCancel={handleCancel}
            onInputChange={handleInputChange}
            onViewDetails={(id) => viewSchoolDetails(String(id))}
            onEnterPortal={(id) => enterSchoolPortal(String(id))}
            onSendBilling={(id) => openBilling(String(id))}
            onSuspend={(school) => openConfirm("suspend", school)}
            onDelete={(school) => openConfirm("delete", school)}
          />
        </div>

        {/* Pagination */}
        <div className="mt-4 rounded-xl bg-slate-900 ring-1 ring-white/10 p-3 sm:p-4">
          <SchoolsPagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      </div>

      {/* Billing modal */}
      {billingOpen && billingSchoolId ? (
        <BillingModal
          escolaId={billingSchoolId}
          onClose={() => {
            setBillingOpen(false);
            setBillingSchoolId(null);
          }}
        />
      ) : null}

      {/* Confirm modal */}
      {confirm.open && confirm.action && confirm.escolaId ? (
        <ConfirmModal
          action={confirm.action}
          escolaId={confirm.escolaId}
          escolaNome={confirm.escolaNome}
          onClose={closeConfirm}
          onChanged={(newStatus) => {
            const escolaId = confirm.escolaId!;
            if (confirm.action === "delete") {
              setSchools((prev) => prev.filter((s) => String(s.id) !== escolaId));
            } else if (newStatus) {
              setSchools((prev) => prev.map((s) => (String(s.id) === escolaId ? { ...s, status: newStatus } : s)));
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ErrorBanner({
  errorMsg,
  loading,
  onRetry,
}: {
  errorMsg: string;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-100 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">Ocorreu um erro</p>
        <p className="mt-1 text-sm break-words text-red-100/90">{errorMsg}</p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
      >
        Tentar novamente
      </button>
    </div>
  );
}



