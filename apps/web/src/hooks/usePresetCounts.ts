"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export function usePresetCounts() {
  const supabase = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("curriculum_preset_subjects")
          .select("id, preset_id");
        if (error) throw error;

        const next: Record<string, number> = {};
        for (const row of data || []) {
          if (!row?.preset_id) continue;
          next[row.preset_id] = (next[row.preset_id] ?? 0) + 1;
        }
        if (!active) return;
        setCounts(next);
      } catch {
        if (!active) return;
        setCounts({});
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  return { counts, loading };
}
