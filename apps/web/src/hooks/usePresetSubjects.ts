"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export type PresetSubject = {
  id: string;
  name: string;
  gradeLevel: string;
  component?: string | null;
  weeklyHours: number;
  subjectType?: string | null;
};

export type PresetMeta = {
  classes: string[];
  subjectsCount: number;
};

export type PresetCatalog = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  courseCode?: string | null;
  badge?: string | null;
  recommended?: boolean | null;
  classMin?: number | null;
  classMax?: number | null;
};

const formatClassLabel = (level: string) => {
  const trimmed = String(level ?? "").trim();
  if (!trimmed) return "";
  const numeric = trimmed.replace(/\D/g, "");
  return numeric ? `${numeric}ª Classe` : trimmed;
};

const sortClassLabels = (items: string[]) => {
  return items.sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    const aVal = Number.isFinite(aNum) ? aNum : Number.MAX_SAFE_INTEGER;
    const bVal = Number.isFinite(bNum) ? bNum : Number.MAX_SAFE_INTEGER;
    return aVal - bVal;
  });
};

export function usePresetsCatalog(presetKeys?: Array<string | null | undefined>) {
  const supabase = useMemo(() => createClient(), []);
  const [catalogMap, setCatalogMap] = useState<Record<string, PresetCatalog>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keysSignature = useMemo(() => {
    const keys = (presetKeys || []).filter(Boolean) as string[];
    return Array.from(new Set(keys)).sort().join("|");
  }, [presetKeys]);

  useEffect(() => {
    let active = true;
    const keys = keysSignature ? keysSignature.split("|") : [];

    if (keys.length === 0) {
      setCatalogMap({});
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: loadError } = await supabase
          .from("curriculum_presets")
          .select("id, name, description, category, course_code, badge, recommended, class_min, class_max")
          .in("id", keys);
        if (loadError) throw loadError;

        const nextMap: Record<string, PresetCatalog> = {};
        (data || []).forEach((row: any) => {
          if (!row?.id) return;
          nextMap[row.id] = {
            id: row.id,
            name: row.name,
            description: row.description ?? null,
            category: row.category ?? null,
            courseCode: row.course_code ?? null,
            badge: row.badge ?? null,
            recommended: row.recommended ?? null,
            classMin: row.class_min ?? null,
            classMax: row.class_max ?? null,
          };
        });

        if (!active) return;
        setCatalogMap(nextMap);
      } catch (err: any) {
        if (!active) return;
        setCatalogMap({});
        setError(err?.message || "Erro ao carregar");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [keysSignature, supabase]);

  return { catalogMap, loading, error };
}

export function usePresetSubjects(presetKey?: string | null, escolaId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<PresetSubject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!presetKey) {
      setSubjects([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data: presetRows, error: presetErr } = await supabase
          .from("curriculum_preset_subjects")
          .select("id, preset_id, name, grade_level, component, weekly_hours, subject_type")
          .eq("preset_id", presetKey);

        if (presetErr) throw presetErr;
        const presetIds = (presetRows || []).map((row: any) => row.id).filter(Boolean);

        let schoolMap = new Map<string, any>();
        if (escolaId && presetIds.length > 0) {
          const { data: schoolRows, error: schoolErr } = await supabase
            .from("school_subjects")
            .select("preset_subject_id, custom_name, custom_weekly_hours, is_active")
            .eq("escola_id", escolaId)
            .in("preset_subject_id", presetIds);
          if (schoolErr) throw schoolErr;
          schoolMap = new Map((schoolRows || []).map((row: any) => [row.preset_subject_id, row]));
        }

        const mapped = (presetRows || [])
          .map((row: any) => {
            const override = schoolMap.get(row.id);
            if (override?.is_active === false) return null;
            return {
              id: row.id,
              name: String(override?.custom_name ?? row.name ?? "").trim(),
              gradeLevel: String(row.grade_level ?? "").trim(),
              component: row.component ?? null,
              weeklyHours: Number(override?.custom_weekly_hours ?? row.weekly_hours ?? 0),
              subjectType: row.subject_type ?? null,
            } as PresetSubject;
          })
          .filter((row): row is PresetSubject => Boolean(row && row.name && row.gradeLevel));

        if (!active) return;
        setSubjects(mapped);
      } catch {
        if (!active) return;
        setSubjects([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [escolaId, presetKey, supabase]);

  return { subjects, loading };
}

export function usePresetsMeta(presetKeys?: Array<string | null | undefined>, escolaId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [metaMap, setMetaMap] = useState<Record<string, PresetMeta>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keysSignature = useMemo(() => {
    const keys = (presetKeys || []).filter(Boolean) as string[];
    return Array.from(new Set(keys)).sort().join("|");
  }, [presetKeys]);

  useEffect(() => {
    let active = true;
    const keys = keysSignature ? keysSignature.split("|") : [];

    if (keys.length === 0) {
      setMetaMap({});
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: presetRows, error: presetErr } = await supabase
          .from("curriculum_preset_subjects")
          .select("preset_id, grade_level, name")
          .in("preset_id", keys);
        if (presetErr) throw presetErr;

        const map = new Map<string, { classes: Set<string>; subjects: Set<string> }>();
        (presetRows || []).forEach((row: any) => {
          const presetId = row.preset_id;
          if (!presetId) return;
          if (!map.has(presetId)) {
            map.set(presetId, { classes: new Set(), subjects: new Set() });
          }
          const entry = map.get(presetId)!;
          const classLabel = formatClassLabel(row.grade_level);
          if (classLabel) entry.classes.add(classLabel);
          const subjectName = String(row.name ?? "").trim();
          if (subjectName) entry.subjects.add(subjectName);
        });

        const nextMap: Record<string, PresetMeta> = {};
        map.forEach((value, key) => {
          nextMap[key] = {
            classes: sortClassLabels(Array.from(value.classes)),
            subjectsCount: value.subjects.size,
          };
        });

        if (!active) return;
        setMetaMap(nextMap);
      } catch (err: any) {
        if (!active) return;
        setMetaMap({});
        setError(err?.message || "Erro ao carregar");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [keysSignature, supabase, escolaId]);

  return { metaMap, loading, error };
}

export function usePresetMeta(presetKey?: string | null, escolaId?: string | null) {
  const { metaMap, loading, error } = usePresetsMeta(presetKey ? [presetKey] : [], escolaId);
  const meta = presetKey ? metaMap[presetKey] ?? null : null;

  return { meta, loading, error };
}
