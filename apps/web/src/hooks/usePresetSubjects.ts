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
